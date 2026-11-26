// 리그 / 팀 정보
// 팀 구성·홈구장은 2026-27 시즌(KBL) / 2026 시즌(U-리그 남자부) 공식 홈페이지 기준.
// venue는 "직접 입력" 시 기본 경기장으로만 쓰이고, 일정 데이터의 경기장은 경기마다 따로 저장됩니다.
// 팀 컬러는 앱 표시용 근사값입니다.

export const LEAGUES = [
  { id: 'kbl', name: 'KBL', full: 'KBL 프로농구', desc: '프로농구 10개 구단', badge: 'KBL' },
  { id: 'uleague', name: '대학농구', full: '대학농구 U-리그 남자부', desc: 'U-리그 남자부', badge: 'U' },
];

export const STAGES = {
  preseason: '오픈매치데이',
  regular: '정규리그',
  dleague: 'D리그',
  po: '플레이오프',
  final: '챔피언결정전',
  semi: '플레이오프 4강',
  ufinal: '플레이오프 결승',
  cup: '컵대회',
  mbc: 'MBC배 전국대학농구 상주대회',
  allstar: '올스타전',
};

/** 단계 이름: 목록에 없으면 직접 입력한 이름 그대로 (예: "상주스토브리그") */
export const stageLabel = (s) => STAGES[s] || s || '';

export const TEAMS = [
  // KBL
  { id: 'sk', leagueId: 'kbl', name: '서울 SK 나이츠', short: 'SK', color: '#E4002B', venue: '잠실학생체육관' },
  { id: 'samsung', leagueId: 'kbl', name: '서울 삼성 썬더스', short: '삼성', color: '#0B4DA2', venue: '잠실학생체육관' },
  { id: 'lg', leagueId: 'kbl', name: '창원 LG 세이커스', short: 'LG', color: '#A50034', venue: '창원체육관' },
  { id: 'mobis', leagueId: 'kbl', name: '울산 현대모비스 피버스', short: '현대모비스', color: '#00287A', venue: '울산동천체육관' },
  { id: 'kt', leagueId: 'kbl', name: '수원 KT 소닉붐', short: 'KT', color: '#D7141A', venue: '수원 KT 소닉붐 아레나' },
  { id: 'db', leagueId: 'kbl', name: '원주 DB 프로미', short: 'DB', color: '#008C45', venue: '원주DB프로미아레나' },
  { id: 'kgc', leagueId: 'kbl', name: '안양 정관장 레드부스터스', short: '정관장', color: '#C8102E', venue: '안양 정관장 아레나' },
  { id: 'sono', leagueId: 'kbl', name: '고양 소노 스카이거너스', short: '소노', color: '#1F3E7A', venue: '고양소노아레나' },
  { id: 'kogas', leagueId: 'kbl', name: '대구 한국가스공사 페가수스', short: '가스공사', color: '#0091D5', venue: '대구체육관' },
  { id: 'kcc', leagueId: 'kbl', name: '부산 KCC 이지스', short: 'KCC', color: '#00296B', venue: '부산사직체육관' },
  // D리그 등에만 나오는 팀 (extra: 응원팀 목록·리그 팀 목록에는 안 나오고, 경기 입력의 팀 선택에만)
  { id: 'sangmu', leagueId: 'kbl', name: '국군체육부대 상무', short: '상무', color: '#3A5A40', venue: '', extra: true },
  // 대학농구 U-리그 남자부
  { id: 'korea', leagueId: 'uleague', name: '고려대', short: '고려대', color: '#8B0029', venue: '고려대학교' },
  { id: 'yonsei', leagueId: 'uleague', name: '연세대', short: '연세대', color: '#003876', venue: '연세대학교' },
  { id: 'chungang', leagueId: 'uleague', name: '중앙대', short: '중앙대', color: '#1B5BAA', venue: '중앙대학교' },
  { id: 'kyunghee', leagueId: 'uleague', name: '경희대', short: '경희대', color: '#9E1B32', venue: '경희대학교' },
  { id: 'skku', leagueId: 'uleague', name: '성균관대', short: '성균관대', color: '#006B3F', venue: '성균관대학교' },
  { id: 'dongguk', leagueId: 'uleague', name: '동국대', short: '동국대', color: '#E8661C', venue: '동국대학교' },
  { id: 'hanyang', leagueId: 'uleague', name: '한양대', short: '한양대', color: '#0E4A84', venue: '한양대학교' },
  { id: 'konkuk', leagueId: 'uleague', name: '건국대', short: '건국대', color: '#036B3F', venue: '건국대학교' },
  { id: 'dankook', leagueId: 'uleague', name: '단국대', short: '단국대', color: '#0F3C8A', venue: '단국대학교' },
  { id: 'myongji', leagueId: 'uleague', name: '명지대', short: '명지대', color: '#002D72', venue: '명지대학교' },
  { id: 'chosun', leagueId: 'uleague', name: '조선대', short: '조선대', color: '#00704A', venue: '조선대학교' },
  { id: 'sangmyung', leagueId: 'uleague', name: '상명대', short: '상명대', color: '#1A3D7C', venue: '상명대학교' },
];

const TEAM_MAP = new Map(TEAMS.map((t) => [t.id, t]));
export const getTeam = (id) => TEAM_MAP.get(id) || null;
export const teamsOf = (leagueId) => TEAMS.filter((t) => t.leagueId === leagueId && !t.extra);
/** D리그 등에만 나오는 팀 (상무) */
export const EXTRA_TEAMS = TEAMS.filter((t) => t.extra);
/** 팀 id면 그 팀, 목록에 없는 이름(직접 입력)이면 이름만 있는 팀 */
export const teamOf = (x) => getTeam(x) || (x ? { id: null, name: x, short: x, color: null } : null);
export const getLeague = (id) => LEAGUES.find((l) => l.id === id) || null;
