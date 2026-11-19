// 일정 사진에서 읽은 글자 → 경기 후보 목록
// 일정표·포스터는 형식이 제각각이라 "날짜는 아래 줄까지 이어진다", "팀 이름 2개가 연달아 나오면 한 경기" 같은
// 느슨한 규칙으로 찾고, 사용자가 확인 화면에서 고치도록 합니다.
import { TEAMS } from '../../data/teams.js';

// ---------- 팀 이름 사전 ----------
// 공식 이름·약칭 외에 자주 쓰는 별명. 띄어쓰기를 지운 글자에서 찾습니다.
const EXTRA_ALIASES = {
  sk: ['SK나이츠', '나이츠', 'SKKNIGHTS'],
  samsung: ['삼성썬더스', '썬더스'],
  lg: ['LG세이커스', '세이커스', '창원LG'],
  mobis: ['현대모비스', '모비스', '피버스'],
  kt: ['KT소닉붐', '소닉붐', '수원KT'],
  db: ['DB프로미', '프로미', '원주DB'],
  kgc: ['정관장', 'KGC', '인삼공사', '레드부스터스'],
  sono: ['소노', '스카이거너스', '고양소노'],
  kogas: ['한국가스공사', '가스공사', '페가수스'],
  kcc: ['KCC', '이지스', '부산KCC'],
  korea: ['고려대학교', '고려대', '고대'],
  yonsei: ['연세대학교', '연세대', '연대'],
  chungang: ['중앙대학교', '중앙대'],
  kyunghee: ['경희대학교', '경희대'],
  skku: ['성균관대학교', '성균관대', '성대'],
  dongguk: ['동국대학교', '동국대'],
  hanyang: ['한양대학교', '한양대'],
  konkuk: ['건국대학교', '건국대', '건대'],
  dankook: ['단국대학교', '단국대'],
  myongji: ['명지대학교', '명지대'],
  chosun: ['조선대학교', '조선대'],
  sangmyung: ['상명대학교', '상명대'],
};

const compact = (s) => s.replace(/\s+/g, '').toUpperCase();

/** [{ alias, id }] 긴 이름부터 (짧은 이름이 긴 이름 일부를 먼저 잡지 않게) */
const ALIASES = TEAMS.flatMap((t) =>
  [...new Set([t.name, t.short, ...(EXTRA_ALIASES[t.id] || [])].map(compact))].map((alias) => ({ alias, id: t.id }))
).sort((a, b) => b.alias.length - a.alias.length);

const isLatin = (c) => /[A-Z]/.test(c || '');

/** 한 줄에서 팀 찾기 → [{ id, pos }] (등장 순서) */
export function findTeams(line) {
  // 띄어쓰기는 지우되, 영문끼리 사이의 공백은 '|'로 남겨 "SK vs KT"가 "SKVSKT"로 붙지 않게
  const s = line
    .toUpperCase()
    .replace(/\s+/g, (m, i, str) => (/[A-Z]/.test(str[i - 1] || '') && /[A-Z]/.test(str[i + m.length] || '') ? '|' : ''));
  const taken = new Array(s.length).fill(false);
  const found = [];
  for (const { alias, id } of ALIASES) {
    let from = 0;
    for (;;) {
      const i = s.indexOf(alias, from);
      if (i < 0) break;
      from = i + 1;
      const end = i + alias.length;
      if (taken.slice(i, end).some(Boolean)) continue;
      // 영문 약칭(SK, LG, KT, DB…)은 다른 영문자에 붙어 있으면 무시 (예: SKY, KTX)
      if (/^[A-Z]+$/.test(alias) && (isLatin(s[i - 1]) || isLatin(s[end]))) continue;
      taken.fill(true, i, end);
      found.push({ id, pos: i });
    }
  }
  return found.sort((a, b) => a.pos - b.pos);
}

// ---------- 날짜·시간 ----------
const DATE_RES = [
  /(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?/g, // 2026.11.19 / 2026년 11월 19일
  /(?<![\d:])(\d{1,2})\s*월\s*(\d{1,2})\s*일/g, // 11월 19일
  /(?<![\d:.])(\d{1,2})\s*[./]\s*(\d{1,2})(?![\d:])\s*(?:\(?\s*[월화수목금토일]\s*\)?)?/g, // 11.19(수) / 11/19
];

/** 오늘 기준 앞뒤 6개월 안에 들도록 연도 추정 */
function guessYear(m, d, today) {
  const y = today.getFullYear();
  const cands = [y - 1, y, y + 1].map((yy) => new Date(yy, m - 1, d, 12));
  return cands.sort((a, b) => Math.abs(a - today) - Math.abs(b - today))[0].getFullYear();
}

const p2 = (n) => String(n).padStart(2, '0');

export function findDates(line, today = new Date()) {
  const out = [];
  const used = [];
  DATE_RES.forEach((re, k) => {
    for (const m of line.matchAll(re)) {
      if (used.some(([a, b]) => m.index < b && m.index + m[0].length > a)) continue;
      const [y, mo, d] = k === 0 ? [+m[1], +m[2], +m[3]] : [null, +m[1], +m[2]];
      if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
      const yy = y || guessYear(mo, d, today);
      used.push([m.index, m.index + m[0].length]);
      out.push({ date: `${yy}-${p2(mo)}-${p2(d)}`, pos: m.index });
    }
  });
  return out.sort((a, b) => a.pos - b.pos);
}

export function findTimes(line) {
  const out = [];
  // 19:00 / 7:00 PM / 오후 7시 30분 / 14시
  const re = /(오전|오후|AM|PM)?\s*(\d{1,2})\s*(?::|시)\s*(\d{2})?\s*(?:분)?\s*(AM|PM)?/gi;
  for (const m of line.matchAll(re)) {
    let h = +m[2];
    const min = m[3] ? +m[3] : 0;
    const ap = (m[1] || m[4] || '').toUpperCase();
    if (!m[3] && !/시/.test(m[0])) continue; // 숫자만 덩그러니 → 시간 아님
    if (h > 24 || min > 59) continue; // 스코어(92:76) 등
    if (ap === '오후' || ap === 'PM') h = h < 12 ? h + 12 : h;
    else if (!ap && h >= 1 && h <= 9) h += 12; // 농구 경기는 대부분 오후
    if (h < 10 || h > 22) continue;
    out.push({ time: `${p2(h)}:${p2(min)}`, pos: m.index });
  }
  return out;
}

const VENUE_RE = /(?:[가-힣A-Za-z]+\s){0,2}[가-힣A-Za-z0-9]*(?:체육관|아레나|대학교(?:\s?[가-힣]+관)?)/g;

/** 줄에서 경기장 찾기 (마지막 것). 앞 단어가 팀 이름이면 떼어냄: "소노 부산사직체육관" → "부산사직체육관" */
function findVenue(line) {
  const all = line?.match(VENUE_RE);
  if (!all) return '';
  let v = all[all.length - 1].trim();
  let words = v.split(' ');
  const filler = (w) => /^(vs|VS|v|대|:|-)$/.test(w);
  while (words.length > 1 && (filler(words[0]) || (!/대학교$/.test(words[0]) && findTeams(words[0]).length)) && words.slice(1).join('').length >= 4) {
    words = words.slice(1);
  }
  return words.join(' ');
}

function stageOf(text) {
  if (/챔피언\s*결정전|챔프전/.test(text)) return 'final';
  if (/4\s*강/.test(text)) return 'semi';
  if (/결승/.test(text)) return 'ufinal';
  if (/플레이\s*오프|PO\b/i.test(text)) return 'po';
  if (/컵\s*대회/.test(text)) return 'cup';
  if (/올스타/.test(text)) return 'allstar';
  return 'regular';
}

/**
 * 글자 → 경기 후보
 * @returns [{ key, date, time, homeId, awayId, leagueId, venue, stage, line }]
 */
export function parseSchedule(text, today = new Date()) {
  const lines = text
    .replace(/[：]/g, ':')
    .replace(/[／]/g, '/')
    .replace(/[｜|]/g, ' ')
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const stage = stageOf(text);
  const teamOf = (id) => TEAMS.find((t) => t.id === id);

  let curDate = null;
  let curTime = null;
  let pending = null; // 혼자 있는 줄의 팀 (다음 줄 팀과 짝: 포스터 "SK / VS / KT")
  let needTime = []; // 시간이 아래 줄에 나오는 포스터용
  const out = [];

  lines.forEach((line, li) => {
    const dates = findDates(line, today);
    if (dates.length) {
      curDate = dates[dates.length - 1].date;
      curTime = null;
      pending = null;
    }
    const times = findTimes(line);
    // 같은 팀이 연달아 잡힌 것 정리 ("정관장 vs 가스공사 안양 정관장 아레나"의 두 번째 정관장은 경기장)
    let teams = findTeams(line).filter((t, i, arr) => i === 0 || t.id !== arr[i - 1].id);
    if (!teams.length && times.length) {
      curTime = times[times.length - 1].time;
      needTime.forEach((g) => (g.time = curTime));
      needTime = [];
    }
    // 한 줄에 팀이 홀수(3개 등)면 마지막은 경기장 이름(예: 고려대학교 화정체육관)으로 봄
    if (teams.length > 1 && teams.length % 2 === 1) teams = teams.slice(0, -1);

    const queue = pending ? [pending, ...teams] : teams;
    pending = null;
    if (queue.length === 1) {
      pending = queue[0];
      return;
    }
    for (let i = 0; i + 1 < queue.length; i += 2) {
      const a = queue[i], b = queue[i + 1];
      const ta = teamOf(a.id), tb = teamOf(b.id);
      const g = {
        date: curDate,
        time: times.length ? times[0].time : curTime || '',
        homeId: a.id,
        awayId: b.id,
        leagueId: ta.leagueId === tb.leagueId ? ta.leagueId : ta.leagueId,
        venue: findVenue(line) || findVenue(lines[li + 1]) || ta.venue,
        stage,
        line,
      };
      if (!g.time) needTime.push(g);
      out.push(g);
    }
  });

  // 날짜 없는 후보는 버리지 않고 남겨 둠(사용자가 날짜 입력) · 같은 경기 중복 제거
  const seen = new Set();
  return out
    .filter((g) => {
      const k = `${g.date}|${[g.homeId, g.awayId].sort().join('-')}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .map((g, i) => ({ ...g, key: `c${i}` }));
}

/** 날짜·시간은 있는데 팀이 2개 미만인 줄이 있으면 true → 영어 전용으로 한 번 더 읽을 가치가 있음 */
export function hasMissingTeams(text, today = new Date()) {
  return text
    .split(/\n+/)
    .some((l) => (findTimes(l).length || findDates(l, today).length) && findTeams(l).length < 2 && /[A-Za-z&《》\\]{2,}/.test(l));
}

/** 두 번 읽은 결과 합치기: 같은 날 같은 두 팀이면 앞쪽(한국어 인식) 것을 남김 */
export function mergeCandidates(a, b) {
  const key = (g) => `${g.date}|${[g.homeId, g.awayId].sort().join('-')}`;
  const seen = new Set(a.map(key));
  return [...a, ...b.filter((g) => !seen.has(key(g)))]
    .sort((x, y) => `${x.date || '9'}${x.time}`.localeCompare(`${y.date || '9'}${y.time}`))
    .map((g, i) => ({ ...g, key: `c${i}` }));
}
