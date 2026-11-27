// 경기 일정 데이터 (공식 홈페이지 기준)
// - KBL: kbl.or.kr 일정 및 결과 (2025-26, 2026-27 시즌 / 오픈매치데이·정규·플레이오프·챔프전)
// - 대학농구: kusf.or.kr U-리그 남자부 (2025, 2026 / 정규리그·플레이오프)
// 각 행: [날짜, 시간, 단계, 홈팀id, 원정팀id, 경기장, 홈점수, 원정점수]  (경기 전이면 점수 null)

import { getTeam, teamOf } from './teams.js';
import kblRows from './schedule/kbl.json';
import uleagueRows from './schedule/uleague.json';
import meta from './schedule/meta.json';

/** 리그별 일정 업데이트 정보 { kbl: { updatedAt, source, seasons, auto }, uleague: {...} } */
export const SCHEDULE_META = meta;

/** '2026-11-14T19:30:00+09:00' → '11월 14일 19:30' */
export function fmtUpdated(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** KBL 마지막 확인 시각 — 배포 시 자동 업데이트가 넣어 줌 (로컬 개발에선 없음) */
const KBL_CHECKED_AT = import.meta.env.VITE_CHECKED_AT || null;

/** 리그별 마지막 확인 시각(ISO). 자동 확인 기록이 없으면 마지막 변경 시각 */
export function checkedAt(leagueId) {
  const m = meta[leagueId];
  if (!m) return null; // 국가대표처럼 일정 데이터가 없는 리그
  if (leagueId === 'kbl' && KBL_CHECKED_AT && KBL_CHECKED_AT > m.updatedAt) return KBL_CHECKED_AT;
  return m.updatedAt;
}

const toGame = (leagueId) => ([date, time, stage, homeId, awayId, venue, homeScore, awayScore]) => ({
  id: `${leagueId}-${date}-${homeId}-${awayId}`,
  leagueId, date, time, stage, homeId, awayId, venue, homeScore, awayScore,
});

const ALL = [...kblRows.map(toGame('kbl')), ...uleagueRows.map(toGame('uleague'))];

const BY_KEY = new Map();
const BY_ID = new Map();
for (const g of ALL) {
  const k = `${g.leagueId}|${g.date}`;
  if (!BY_KEY.has(k)) BY_KEY.set(k, []);
  BY_KEY.get(k).push(g);
  BY_ID.set(g.id, g);
}

export const getGames = (leagueId, date) => BY_KEY.get(`${leagueId}|${date}`) || [];
export const getGame = (id) => BY_ID.get(id) || null;
export const isFinished = (g) => g.homeScore != null && g.awayScore != null;

/** KBL 홈구장 목록 (정규리그 기준, 시즌마다 바뀐 구장 포함) → 구장 도장깨기용 */
export const KBL_VENUES = (() => {
  const map = new Map();
  for (const g of ALL) {
    if (g.leagueId !== 'kbl' || g.stage !== 'regular') continue;
    if (!map.has(g.venue)) map.set(g.venue, new Set());
    map.get(g.venue).add(g.homeId);
  }
  return [...map.entries()]
    .map(([venue, ids]) => ({ venue, teams: [...ids].map(getTeam) }))
    .sort((a, b) => a.venue.localeCompare(b.venue, 'ko'));
})();

/** 일기에 저장할 경기 스냅샷 (나중에 일정 데이터가 바뀌어도 기록은 유지) */
export function snapshotGame(g) {
  const side = (t) => ({ id: t.id, name: t.name, short: t.short, color: t.color });
  return {
    id: g.id,
    leagueId: g.leagueId,
    stage: g.stage,
    time: g.time,
    venue: g.venue,
    home: side(teamOf(g.homeId)),
    away: side(teamOf(g.awayId)),
    custom: false,
  };
}
