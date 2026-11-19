// "내 일정": 사진으로 가져와 이 기기에만 저장한 경기
// 공식 일정 경기와 같은 모양 { id, leagueId, date, time, stage, homeId, awayId, venue, homeScore, awayScore }
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../lib/db.js';
import { getGames } from '../../data/games.js';

export const myGameId = (g) => `my-${g.leagueId}-${g.date}-${g.homeId}-${g.awayId}`;
export const isMyGame = (id) => typeof id === 'string' && id.startsWith('my-');

/** 공식 일정에 이미 있는 경기인지 (같은 날 같은 두 팀) */
export function inOfficial(g) {
  return getGames(g.leagueId, g.date).some(
    (o) => [o.homeId, o.awayId].sort().join() === [g.homeId, g.awayId].sort().join()
  );
}

export async function addMyGames(list) {
  const rows = list.map((g) => ({
    id: myGameId(g),
    leagueId: g.leagueId,
    date: g.date,
    time: g.time || '',
    stage: g.stage || 'regular',
    homeId: g.homeId,
    awayId: g.awayId,
    venue: g.venue || '',
    homeScore: null,
    awayScore: null,
    mine: true,
    createdAt: Date.now(),
  }));
  await db.myGames.bulkPut(rows);
  return rows.length;
}

export const deleteMyGame = (id) => db.myGames.delete(id);

/** 하루치 내 일정 */
export const useMyGamesOn = (date) =>
  useLiveQuery(() => db.myGames.where('date').equals(date).toArray(), [date], []);

/** 기간 내 내 일정 (달력 표시용) */
export const useMyGamesBetween = (start, end) =>
  useLiveQuery(() => db.myGames.where('date').between(start, end, true, true).toArray(), [start, end], []);
