// KBL 일정·결과 자동 업데이트
//   npm run update:kbl
//
// kbl.or.kr "일정 및 결과" 공개 페이지를 실제 브라우저(Edge/Chrome)로 열어
// 지난달 ~ 시즌 종료(5월)까지 월별 경기를 읽고 src/data/schedule/kbl.json 에 반영합니다.
// - 비공개 API는 호출하지 않고, 사람이 보는 화면만 읽습니다.
// - 한 번 실행에 페이지 1개 + 월 이동 클릭 약 10회 (월 사이 1.5초 대기).
// - 변경이 있을 때만 파일과 meta.json(updatedAt)을 갱신합니다.

import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';

const DIR = new URL('../src/data/schedule/', import.meta.url);
const KBL_FILE = new URL('kbl.json', DIR);
const META_FILE = new URL('meta.json', DIR);
const URL_SCHEDULE = 'https://www.kbl.or.kr/match/schedule';

const TEAM_ID = {
  한국가스공사: 'kogas', DB: 'db', 소노: 'sono', KCC: 'kcc', 정관장: 'kgc',
  SK: 'sk', 현대모비스: 'mobis', 삼성: 'samsung', KT: 'kt', LG: 'lg',
};
const STAGE = {
  정규시즌: 'regular', 플레이오프: 'po', 챔피언결정전: 'final', 'OPEN MATCH DAY': 'preseason', 컵대회: 'cup',
};

const pad = (n) => String(n).padStart(2, '0');
const kstNowIso = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 19) + '+09:00';

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
            label: li.querySelector('.label')?.textContent.trim(),
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
  const played = !(g.home.score === '0' && g.away.score === '0');
  return [g.date, g.time, stage, h, a, g.venue, played ? Number(g.home.score) : null, played ? Number(g.away.score) : null];
}

async function main() {
  const months = targetMonths();
  console.log('대상 월:', months.join(', '));

  const channel = process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chrome');
  const browser = await chromium.launch({ channel, headless: true });
  const fetched = {};
  try {
    const page = await browser.newPage({ locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
    await page.goto(URL_SCHEDULE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForSelector('.ic-date-nav-prev', { timeout: 30000 });
    for (const ym of months) {
      await goToMonth(page, ym);
      const rows = (await extract(page)).filter((g) => g.date.startsWith(ym)).map(toRow).filter(Boolean);
      fetched[ym] = rows;
      console.log(`  ${ym}: ${rows.length}경기`);
    }
  } finally {
    await browser.close();
  }

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
    console.log('변경 없음 ✅');
    return;
  }

  writeFileSync(KBL_FILE, '[\n' + merged.map((r) => JSON.stringify(r)).join(',\n') + '\n]\n', 'utf8');
  const meta = JSON.parse(readFileSync(META_FILE, 'utf8'));
  meta.kbl.updatedAt = kstNowIso();
  writeFileSync(META_FILE, JSON.stringify(meta, null, 2) + '\n', 'utf8');
  console.log(`업데이트 완료: 추가 ${added.length} · 변경 ${changed.length} · 삭제 ${removed.length} (총 ${merged.length}경기)`);
  for (const k of changed.slice(0, 10)) console.log('  변경:', newMap.get(k));
}

main().catch((e) => {
  console.error('❌', e.message);
  process.exit(1);
});
