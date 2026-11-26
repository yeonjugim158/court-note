// 글자 위치(단어 상자)를 이용한 일정 찾기
// - 단어들을 줄(행)로 묶어 "줄 글자"를 만들고 (일반 일정표·포스터용 parse.js에 넘김)
// - 표 형식(맨 위 행에 시간 13:00 15:00 …, 왼쪽에 날짜, 칸마다 "고려대 - 명지대")이면
//   칸 위치로 시간 열·날짜 행을 찾아 경기로 만듭니다.
import { TEAMS } from '../../data/teams.js';
import { findDates, findTeams, findTimes } from './parse.js';

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

/** 단어 상자 → 줄 [{ y, words: [...] (x순) }] */
export function groupRows(words) {
  const ws = words.filter((w) => w.t && w.t.trim()).map((w) => ({ ...w, yc: (w.y0 + w.y1) / 2, xc: (w.x0 + w.x1) / 2 }));
  const h = median(ws.map((w) => w.y1 - w.y0)) || 10;
  ws.sort((a, b) => a.yc - b.yc);
  const rows = [];
  for (const w of ws) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(w.yc - row.y) < h * 0.6) {
      row.words.push(w);
      row.y = (row.y * (row.words.length - 1) + w.yc) / row.words.length;
    } else rows.push({ y: w.yc, words: [w] });
  }
  for (const r of rows) r.words.sort((a, b) => a.x0 - b.x0);
  return rows;
}

/** 줄 글자 + 글자 위치 → 단어(x) 찾기용 */
function rowString(row) {
  let s = '';
  const at = []; // 글자 인덱스 → 단어
  row.words.forEach((w, i) => {
    if (i) { s += ' '; at.push(w); }
    for (const ch of w.t) { s += ch; at.push(w); }
  });
  return { s, at };
}

// 글자별로 떨어져 읽힌 한글 붙이기 ("화 정 체육관" → "화정체육관")
/** 글자 하나씩 떨어져 읽힌 한글 조각 붙이기: "성" "균" "관대" → "성균관대" (간격이 글자 높이의 절반보다 좁을 때) */
function joinHangulPieces(words) {
  const out = [];
  for (const w of words) {
    const prev = out[out.length - 1];
    const h = Math.max(w.y1 - w.y0, 8);
    if (prev && /[가-힣]$/.test(prev.t) && /^[가-힣]/.test(w.t) && w.x0 - prev.x1 < h * 0.5) {
      out[out.length - 1] = { ...prev, t: prev.t + w.t, x1: Math.max(prev.x1, w.x1), xc: (prev.x0 + Math.max(prev.x1, w.x1)) / 2 };
    } else out.push(w);
  }
  return out;
}

/** 깨진 경기장 이름(한글이 적음)은 다른 온전한 이름을 빌려 씀: "AFX oTra 관 (신관)" + "상주실내체육관 (구관)" → "상주실내체육관 (신관)" */
function fixVenues(venues) {
  const ok = (n) => (n.match(/[가-힣]/g) || []).length >= n.replace(/[\s()]/g, '').length * 0.7;
  const good = venues.find((v) => ok(v.name));
  for (const v of venues) {
    if (ok(v.name)) continue;
    if (!good) { v.name = ''; continue; }
    const paren = v.name.match(/\([가-힣]+\)\s*$/)?.[0];
    v.name = good.name.replace(/\s*\([^)]*\)\s*$/, '') + (paren ? ` ${paren}` : '');
  }
}

export const rowsToText = (rows) => rows.map((r) => rowString(r).s.replace(/(?<=[가-힣]) (?=[가-힣])/g, '')).join('\n');

/** "6일(월)"처럼 월이 깨진 날짜: 일만 찾고 월은 앞 날짜에서 */
const DAY_ONLY = /(?<![\d.])(\d{1,2})\s*일\s*\(?\s*[월화수목금토일]/g;

/**
 * 표 형식 일정 찾기
 * @returns 경기 후보 [] (표가 아니면 빈 배열)
 */
export function parseTable(rows, today = new Date()) {
  let anchors = null; // 현재 시간 열 [{ x, time }]
  // 첫 줄 날짜의 월이 깨졌을 때("2% 3일") 쓸 기준: 표 안에서 처음 나오는 온전한 날짜
  let lastDate = null;
  for (const r of rows) {
    const d = findDates(rowString(r).s, today)[0];
    if (d) { lastDate = d.date; break; }
  }
  const venues = []; // [{ x, y, name }]  "장 소 : 상주실내체육관 (신관)"
  const out = [];
  const allText = rowsToText(rows);
  // "제42회 MBC배 …대회" 같은 대회 일정표면 컵대회로 (제목이 일부 깨져도 "제42회"·"MBC"로 알아봄)
  const stage = /D\s*리그|디리그/i.test(allText) ? 'dleague' : /MBC|엠비씨/i.test(allText) ? 'mbc' : /대회|배\s|제\s*\d+\s*회/.test(allText) ? 'cup' : /플레이\s*오프/.test(allText) ? 'po' : 'regular';

  for (const row of rows) {
    const { s, at } = rowString(row);

    // 경기장 표시
    for (const m of s.matchAll(/장\s*소\s*[:：]?\s*(.+?)(?=\s[=■•▪]?\s*장\s*소|$)/g)) {
      const name = m[1]
        .replace(/[=■•▪|"'“”‘’]/g, '')
        .replace(/(?<=[가-힣]) (?=[가-힣])/g, '') // "상 주 실 내" → "상주실내"
        .trim();
      if (name) venues.push({ x: at[m.index]?.x0 ?? 0, y: row.y, name });
    }

    // 시간 머리줄
    const times = findTimes(s);
    if (times.length >= 2) {
      fixVenues(venues);
      anchors = times.map((t) => ({ x: at[t.pos]?.xc ?? 0, time: t.time }));
      continue;
    }

    // 날짜 (월이 깨졌으면 앞 날짜의 월)
    const dates = findDates(s, today).map((d) => ({ x: at[d.pos]?.x0 ?? 0, date: d.date }));
    if (lastDate) {
      for (const m of s.matchAll(DAY_ONLY)) {
        const x = at[m.index]?.x0 ?? 0;
        if (dates.some((d) => Math.abs(d.x - x) < 60)) continue;
        const day = Number(m[1]);
        if (day < 1 || day > 31) continue;
        dates.push({ x, date: `${lastDate.slice(0, 8)}${String(day).padStart(2, '0')}` });
      }
    }
    dates.sort((a, b) => a.x - b.x);
    if (dates.length) lastDate = dates[dates.length - 1].date;
    if (!anchors) continue;

    // 칸 안의 팀 (단어 하나씩: "동국대wise"·"동국대\156" 같은 분교 표기는 다른 팀으로 봄)
    const teams = joinHangulPieces(row.words)
      .flatMap((w) => {
        const found = findTeams(w.t, { strictSuffix: true });
        const len = w.t.replace(/\s+/g, '').length || 1;
        // 한 단어에 팀이 여럿 붙어 읽힌 경우("명지대건국대") 글자 위치로 x를 나눔
        return found.map((t) => ({ id: t.id, x: found.length > 1 ? w.x0 + ((t.pos + 1.5) / len) * (w.x1 - w.x0) : w.xc }));
      })
      .sort((a, b) => a.x - b.x);
    const colOf = (x) => anchors.reduce((best, a) => (Math.abs(a.x - x) < Math.abs(best.x - x) ? a : best), anchors[0]);

    // 열 간격 (두 표가 나란히 있어도 같은 표 안 이웃 열 간격이 가장 흔함)
    const gap = anchors.length > 1 ? median(anchors.slice(1).map((c, k) => Math.abs(c.x - anchors[k].x)).filter((g) => g > 20)) : 300;
    for (let i = 0; i + 1 < teams.length; i++) {
      const a = teams[i], b = teams[i + 1];
      if (a.id === b.id) continue;
      // 한 칸 = 열 가운데(시간) 왼쪽에 앞 팀, 오른쪽에 뒤 팀
      const col = colOf((a.x + b.x) / 2);
      const inCell = a.x < col.x && b.x > col.x && col.x - a.x < gap * 0.6 && b.x - col.x < gap * 0.6;
      if (!inCell) continue;
      const date = [...dates].reverse().find((d) => d.x < a.x)?.date;
      if (!date) continue; // 날짜 없는 줄(팀 목록·범례 등)은 무시
      const venue = [...venues].filter((v) => v.y < row.y && v.x <= a.x + 50).sort((p, q) => q.x - p.x)[0]?.name;
      const ta = TEAMS.find((t) => t.id === a.id);
      out.push({ date, time: col.time, homeId: a.id, awayId: b.id, leagueId: ta.leagueId, venue: venue || ta.venue, stage, line: s.slice(0, 80) });
      i++; // b는 이 경기에 씀
    }
  }
  return out;
}
