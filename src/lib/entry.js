export const MODES = {
  live: { label: '직관', icon: '🏟️', desc: '경기장에서 직접 봤어요' },
  home: { label: '집관', icon: '📺', desc: '중계로 챙겨 봤어요' },
};

export const MOODS = ['😫', '😕', '🙂', '😄', '🤩'];
export const SEAT_ZONES = ['코트사이드', '1층', '2층', '기타'];
export const WATCH_VIA = ['TV', 'OTT', '유튜브', '펍·식당', '기타'];

/** 응원팀 기준 결과: 'W' | 'L' | 'D' | null */
export function resultOf(entry) {
  const { cheer, score } = entry;
  if (!score || (cheer !== 'home' && cheer !== 'away')) return null;
  const h = score.home, a = score.away;
  if (h == null || a == null || h === '' || a === '') return null;
  const mine = cheer === 'home' ? Number(h) : Number(a);
  const theirs = cheer === 'home' ? Number(a) : Number(h);
  if (mine > theirs) return 'W';
  if (mine < theirs) return 'L';
  return 'D';
}

export const RESULT_LABEL = { W: '승', L: '패', D: '무' };

export const hasScore = (e) => e.score && e.score.home !== '' && e.score.home != null && e.score.away !== '' && e.score.away != null;

export const sortEntries = (list) =>
  [...list].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1));
