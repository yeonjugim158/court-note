// KBL 일정·결과 자동 업데이트
//   npm run update:kbl
//
// kbl.or.kr 공개 페이지를 실제 브라우저(Edge/Chrome)로 열어 읽습니다. (비공개 API는 호출하지 않음)
//
// 1) 일정·결과 → src/data/schedule/kbl.json (+ meta.json updatedAt)
//    지난달 ~ 시즌 종료(5월)까지 월별로 읽고, 바뀐 게 있을 때만 저장
// 2) 부가 정보 → public/data/ (앱이 실행 중에 불러옴. 실패해도 1)에는 영향 없음)
//    - extra.json          경기별 { k: KBL 경기키, ch: 중계 채널 코드[], hl: 하이라이트 유튜브 id }
//    - box/<경기id>.json    끝난 경기의 선수 기록 [번호, 이름, 출전시간, 득점, 리바운드, 어시스트]
//    - rosters.json        팀별 등록 선수 [번호, 이름, 포지션] (하루 1번)

import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../src/data/schedule/', import.meta.url);
const KBL_FILE = new URL('kbl.json', DIR);
const META_FILE = new URL('meta.json', DIR);
const DATA = new URL('../public/data/', import.meta.url);
const EXTRA_FILE = new URL('extra.json', DATA);
const ROSTER_FILE = new URL('rosters.json', DATA);
const BOX_DIR = new URL('box/', DATA);

const URL_SCHEDULE = 'https://www.kbl.or.kr/match/schedule';
const URL_HIGHLIGHT = 'https://www.kbl.or.kr/media/highlight';
const URL_PLAYERS = 'https://www.kbl.or.kr/player/player';
const BOX_PER_RUN = 12; // 한 번 실행에 새로 가져올 선수 기록 최대 경기 수 (서버 부담·실행 시간 제한)

const TEAM_ID = {
  한국가스공사: 'kogas', DB: 'db', 소노: 'sono', KCC: 'kcc', 정관장: 'kgc',
  SK: 'sk', 현대모비스: 'mobis', 삼성: 'samsung', KT: 'kt', LG: 'lg',
};
/** 선수 목록의 지역명 포함 팀 이름 → id */
const TEAM_BY_FULL = {
  '서울 SK': 'sk', '원주 DB': 'db', '울산 현대모비스': 'mobis', '서울 삼성': 'samsung', '고양 소노': 'sono',
  '창원 LG': 'lg', '안양 정관장': 'kgc', '부산 KCC': 'kcc', '수원 KT': 'kt', '대구 한국가스공사': 'kogas',
};
const STAGE = {
  정규시즌: 'regular', 플레이오프: 'po', 챔피언결정전: 'final', 'OPEN MATCH DAY': 'preseason', 컵대회: 'cup',
};

const pad = (n) => String(n).padStart(2, '0');
const kstNowIso = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19) + '+09:00';
const gameIdOf = (row) => `kbl-${row[0]}-${row[3]}-${row[4]}`;
const sortKeys = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
const readJson = (url, fallback) => (existsSync(url) ? JSON.parse(readFileSync(url, 'utf8')) : fallback);

/** 내용이 바뀌었을 때만 저장 → 바뀌었으면 true */
function writeJsonIfChanged(url, data) {
  const text = JSON.stringify(data) + '\n';
  if (existsSync(url) && readFileSync(url, 'utf8') === text) return false;
  writeFileSync(url, text, 'utf8');
  return true;
}

/** 지난달부터 시즌 종료(5월)까지 'YYYY-MM' 목록 */
function targetMonths(now = new Date(Date.now() + 9 * 3600e3)) {
  let y = now.getUTCFullYear(), m = now.getUTCMonth() + 1;
  const endY = m >= 6 ? y + 1 : y;
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  const out = [];
  while (y < endY || (y === endY && m <= 5)) {
    out.push(`${y}-${pad(m)}`);
    m += 1; if (m === 13) { m = 1; y += 1; }
  }
  return out;
}

const monthIndex = (ym) => { const [y, m] = ym.split('-').map(Number); return y * 12 + m; };

async function readMonth(page) {
  return page.evaluate(() => {
    const t = document.querySelector('.ic-date-nav-prev')?.closest('div')?.textContent || '';
    const m = t.match(/(\d{4})\.\s*(\d{1,2})/);
    return m ? `${m[1]}-${m[2].padStart(2, '0')}` : null;
  });
}

async function extract(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll('.game-schedule-list')].flatMap((g) => {
      const d = g.id.replace('game-', '');
      return [...g.querySelectorAll(':scope > ul > li')]
        .filter((li) => li.querySelector('ul.versus'))
        .map((li) => {
          const info = [...li.querySelectorAll('.desc ul li')].map((x) => x.textContent.trim());
          const t = [...li.querySelectorAll('ul.versus > li')].map((x) => ({
            name: x.querySelector('div p')?.textContent.trim(),
            score: x.querySelector(':scope > p')?.textContent.trim(),
          }));
          return {
            date: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`,
            key: li.querySelector('[data-key]')?.getAttribute('data-key') || null,
            ch: [...li.querySelectorAll('.channel img')]
              .map((i) => (i.getAttribute('src') || '').match(/logo-(\w+)\./)?.[1])
              .filter(Boolean),
            label: li.querySelector('.label')?.textContent.trim(),
            // 진행 중인 경기: 새로고침 버튼이 있고 '기록' 버튼이 빨간색
            live: !!li.querySelector('.ic-reset') || !!li.querySelector('ul.link button.red'),
            time: info[0], venue: info[1], home: t[0], away: t[1],
          };
        });
    })
  );
}

async function goToMonth(page, target) {
  for (let guard = 0; guard < 24; guard++) {
    const cur = await readMonth(page);
    if (cur === target) return;
    const sel = monthIndex(cur) > monthIndex(target) ? '.ic-date-nav-prev' : '.ic-date-nav-next';
    await page.locator(sel).first().click();
    await page.waitForFunction((prev) => {
      const t = document.querySelector('.ic-date-nav-prev')?.closest('div')?.textContent || '';
      return !t.includes(prev.replace('-', '. '));
    }, cur, { timeout: 15000 });
    await page.waitForTimeout(1500); // 데이터 로딩 + 서버 부담 줄이기
  }
  throw new Error(`월 이동 실패: ${target}`);
}

function toRow(g) {
  const stage = STAGE[g.label];
  const h = TEAM_ID[g.home?.name], a = TEAM_ID[g.away?.name];
  if (!stage || !h || !a) return null; // D리그·EASL·올스타 등 제외
  const played = !g.live && !(g.home.score === '0' && g.away.score === '0');
  return [g.date, g.time, stage, h, a, g.venue, played ? Number(g.home.score) : null, played ? Number(g.away.score) : null];
}

/** 1) 일정·결과 반영 */
function updateSchedule(fetched) {
  const old = JSON.parse(readFileSync(KBL_FILE, 'utf8'));
  const oldByMonth = {};
  for (const r of old) (oldByMonth[r[0].slice(0, 7)] ||= []).push(r);

  const total = Object.values(fetched).reduce((s, r) => s + r.length, 0);
  if (total === 0) throw new Error('가져온 경기가 0개예요. 페이지 구조가 바뀌었을 수 있어 저장하지 않았어요.');

  // 예전엔 경기가 있던 달이 갑자기 0이면 읽기 실패로 보고 기존 값 유지
  for (const ym of Object.keys(fetched)) {
    if (fetched[ym].length === 0 && (oldByMonth[ym]?.length || 0) > 0) {
      console.warn(`  ⚠️ ${ym}: 새로 읽은 경기가 없어 기존 ${oldByMonth[ym].length}경기를 유지해요`);
      fetched[ym] = oldByMonth[ym];
    }
  }

  const merged = [...old.filter((r) => !(r[0].slice(0, 7) in fetched)), ...Object.values(fetched).flat()]
    .sort((a, b) => (a[0] + a[1] + a[3]).localeCompare(b[0] + b[1] + b[3]));

  const key = (r) => `${r[0]}|${r[3]}|${r[4]}`;
  const oldMap = new Map(old.map((r) => [key(r), JSON.stringify(r)]));
  const newMap = new Map(merged.map((r) => [key(r), JSON.stringify(r)]));
  const added = [...newMap.keys()].filter((k) => !oldMap.has(k));
  const removed = [...oldMap.keys()].filter((k) => !newMap.has(k));
  const changed = [...newMap.keys()].filter((k) => oldMap.has(k) && oldMap.get(k) !== newMap.get(k));

  if (!added.length && !removed.length && !changed.length) {
    console.log('일정 변경 없음 ✅');
    return;
  }

  writeFileSync(KBL_FILE, '[\n' + merged.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n', 'utf8');
  const meta = JSON.parse(readFileSync(META_FILE, 'utf8'));
  meta.kbl.updatedAt = kstNowIso();
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`일정 업데이트: 추가 ${added.length} · 변경 ${changed.length} · 삭제 ${removed.length} (총 ${merged.length}경기)`);
  for (const k of changed.slice(0, 10)) console.log('  변경:', newMap.get(k));
}

/** 2-1) 하이라이트 목록 첫 페이지 → 아직 모르는 경기만 눌러서 유튜브 id 확인 */
async function updateHighlights(page, extra) {
  await page.goto(URL_HIGHLIGHT, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('.media-type2 > li', { timeout: 30000 });
  const items = await page.evaluate(() =>
    [...document.querySelectorAll('.media-type2 > li')].map((li) => ({
      title: li.querySelector('.desc p')?.textContent.trim() || '',
      date: li.querySelector('.date-time li')?.textContent.trim() || '',
    }))
  );
  let added = 0;
  for (let i = 0; i < items.length; i++) {
    const m = items[i].title.match(/^(\S+)\s*:\s*(\S+)/);
    const h = m && TEAM_ID[m[1]], a = m && TEAM_ID[m[2]];
    if (!h || !a) continue;
    const id = `kbl-${items[i].date.replaceAll('.', '-')}-${h}-${a}`;
    if (!extra[id] || extra[id].hl) continue;
    const ok = await page.evaluate((n) => {
      const el = document.querySelectorAll('.media-type2 > li .desc p')[n];
      el?.click();
      return !!el;
    }, i);
    if (!ok) continue;
    const src = await page.waitForSelector('iframe[src*="youtube"]', { timeout: 15000 }).then((f) => f.getAttribute('src'));
    const yt = src?.match(/embed\/([\w-]{6,})/)?.[1];
    if (yt) {
      extra[id].hl = yt;
      added++;
    }
    await page.goto(URL_HIGHLIGHT, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction((n) => document.querySelectorAll('.media-type2 > li .desc p').length >= n, items.length, { timeout: 30000 });
    await page.waitForTimeout(800);
  }
  console.log(`  하이라이트: 새로 ${added}개`);
}

/** 2-2) 끝난 경기 중 선수 기록이 없는 경기 → 경기기록 페이지의 홈/원정 선수 기록 */
async function updateBoxScores(page, extra) {
  const rows = JSON.parse(readFileSync(KBL_FILE, 'utf8'));
  const todo = rows
    .filter((r) => r[6] != null && extra[gameIdOf(r)]?.k && !existsSync(new URL(`${gameIdOf(r)}.json`, BOX_DIR)))
    .sort((x, y) => y[0].localeCompare(x[0]))
    .slice(0, BOX_PER_RUN);
  let saved = 0;
  for (const r of todo) {
    const id = gameIdOf(r);
    await page.goto(`https://www.kbl.or.kr/match/record/${extra[id].k}/${r[0].replaceAll('-', '')}`, {
      waitUntil: 'networkidle', timeout: 60000,
    });
    await page.locator('a', { hasText: /^경기기록$/ }).first().click();
    await page.waitForFunction(
      () => [...document.querySelectorAll('table thead')].some((t) => t.textContent.includes('선수명')),
      null, { timeout: 20000 }
    );
    const box = await page.evaluate(() =>
      [...document.querySelectorAll('table')]
        .filter((t) => t.querySelector('thead')?.textContent.includes('선수명'))
        .slice(0, 2)
        .map((t) => {
          const head = [...t.querySelectorAll('thead th')].map((x) => x.textContent.trim());
          const col = (n) => head.indexOf(n);
          return [...t.querySelectorAll('tbody tr')]
            .map((tr) => [...tr.querySelectorAll('td,th')].map((c) => c.textContent.trim().replace(/\s+/g, ' ')))
            .filter((c) => c[1] && c[1] !== '계')
            .map((c) => {
              const dnp = c.length < 5; // 미출전
              const n = (k) => (dnp ? 0 : Number(c[col(k)]) || 0);
              return [c[0], c[1], dnp ? '' : c[col('Min')], n('PTS'), n('REB'), n('AST')];
            });
        })
    );
    if (box.length === 2 && box[0].length && box[1].length) {
      writeFileSync(new URL(`${id}.json`, BOX_DIR), JSON.stringify({ home: box[0], away: box[1] }) + '\n', 'utf8');
      saved++;
    }
    await page.waitForTimeout(1200);
  }
  console.log(`  선수 기록: 새로 ${saved}경기`);
}

/** 2-3) 등록 선수 명단 (하루 1번) */
async function updateRosters(page) {
  const old = readJson(ROSTER_FILE, null);
  if (old && Date.now() - new Date(old.updatedAt).getTime() < 20 * 3600e3) return;
  await page.goto(URL_PLAYERS, { waitUntil: 'networkidle', timeout: 60000 });
  const teams = {};
  const firstCell = () => page.evaluate(() => document.querySelector('table tbody tr')?.textContent.trim().slice(0, 30));
  for (let p = 1; p <= 15; p++) {
    await page.waitForFunction(
      () => [...document.querySelectorAll('table thead')].some((t) => t.textContent.includes('포지션')),
      null, { timeout: 20000 }
    );
    const rows = await page.evaluate(() =>
      [...document.querySelectorAll('table tbody tr')].map((tr) =>
        [...tr.querySelectorAll('td,th')].map((c) => c.textContent.trim().replace(/\s+/g, ' '))
      )
    );
    for (const [name, team, no, pos] of rows) {
      const id = TEAM_BY_FULL[team];
      if (id && name) (teams[id] ||= []).push([no, name, pos]);
    }
    // 페이지 이동은 숫자 목록(select)
    const pageSel = await page.evaluate((n) => {
      const sels = [...document.querySelectorAll('select')];
      return sels.findIndex((s) => [...s.options].some((o) => o.value === String(n)) && [...s.options].every((o) => /^\d+$/.test(o.value)));
    }, p + 1);
    if (pageSel < 0) break;
    const before = await firstCell();
    await page.locator('select').nth(pageSel).selectOption(String(p + 1));
    await page.waitForFunction((b) => document.querySelector('table tbody tr')?.textContent.trim().slice(0, 30) !== b, before, { timeout: 15000 });
    await page.waitForTimeout(800);
  }
  const count = Object.values(teams).reduce((s, l) => s + l.length, 0);
  if (count < 100) throw new Error(`선수가 ${count}명뿐이라 저장하지 않았어요`);
  for (const l of Object.values(teams)) l.sort((x, y) => Number(x[0]) - Number(y[0]));
  writeJsonIfChanged(ROSTER_FILE, { updatedAt: kstNowIso(), teams: sortKeys(teams) });
  console.log(`  선수 명단: ${count}명`);
}

async function main() {
  const months = targetMonths();
  console.log('대상 월:', months.join(', '));

  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
  const browser = await chromium.launch({ channel, headless: true });
  const fetched = {};
  const extra = readJson(EXTRA_FILE, {});
  try {
    const page = await browser.newPage({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await page.goto(URL_SCHEDULE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.ic-date-nav-prev', { timeout: 30000 });
    for (const ym of months) {
      await goToMonth(page, ym);
      const rows = [];
      for (const g of (await extract(page)).filter((g) => g.date.startsWith(ym))) {
        const row = toRow(g);
        if (!row) continue;
        rows.push(row);
        const id = gameIdOf(row);
        const { live: _old, ...prev } = extra[id] || {};
        extra[id] = { ...prev, ...(g.key && { k: g.key }), ch: g.ch, ...(g.live && { live: [Number(g.home.score), Number(g.away.score)] }) };
      }
      fetched[ym] = rows;
      console.log(`  ${ym}: ${rows.length}경기`);
    }

    updateSchedule(fetched);

    // 부가 정보: 실패해도 일정 업데이트에는 영향 없음
    mkdirSync(BOX_DIR, { recursive: true });
    for (const [name, fn] of [
      ['하이라이트', () => updateHighlights(page, extra)],
      ['선수 기록', () => updateBoxScores(page, extra)],
      ['선수 명단', () => updateRosters(page)],
    ]) {
      try {
        await fn();
      } catch (e) {
        console.warn(`  ⚠️ ${name} 가져오기 실패: ${e.message.split('\n')[0]}`);
      }
    }
    if (writeJsonIfChanged(EXTRA_FILE, sortKeys(extra))) console.log('  경기 부가정보(extra.json) 갱신');
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
