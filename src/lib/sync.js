// 경기 중에 남긴 기록(스코어 빈칸)에, 경기가 끝난 뒤 일정 데이터의 최종 스코어를 채워 넣습니다.
// - 일정에서 고른 경기(game.id 있음, 직접 입력 아님)만 대상
// - 스코어가 비어 있을 때만 채움 → 직접 적은 스코어는 절대 덮어쓰지 않음
// 일정 데이터는 앱에 포함되어 배포되므로, 앱을 열 때 한 번 실행하면 충분합니다.

import { db } from './db.js';
import { hasScore } from './entry.js';
import { getGame, isFinished } from '../data/games.js';

export async function fillFinishedScores() {
  const entries = await db.entries.toArray();
  const updates = [];
  for (const e of entries) {
    if (hasScore(e) || !e.game?.id || e.game.custom) continue;
    const g = getGame(e.game.id);
    if (g && isFinished(g)) updates.push({ ...e, score: { home: g.homeScore, away: g.awayScore }, scoreAuto: true });
  }
  if (updates.length) await db.entries.bulkPut(updates);
  return updates.length;
}
