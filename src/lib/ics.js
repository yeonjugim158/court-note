// 경기 1개 → 아이폰 캘린더용 .ics 파일 내용
// 알림: 경기 당일 오전 10시(경기가 11시 이후일 때) + 경기 1시간 전
// 빌드 때(vite.config.js) 경기마다 ics/<경기id>.ics 정적 파일로 만들어 둡니다.
// (아이폰 홈 화면 앱에서는 정적 .ics 주소를 열어야 "캘린더에 추가" 화면이 가장 확실하게 떠요)

const STAGE_LABEL = {
  preseason: '오픈매치데이', regular: '정규리그', po: '플레이오프', final: '챔피언결정전',
  semi: '플레이오프 4강', ufinal: '플레이오프 결승', cup: '컵대회', allstar: '올스타전',
};
const LEAGUE_LABEL = { kbl: 'KBL', uleague: 'U-리그' };

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const p2 = (n) => String(n).padStart(2, '0');

/** KST 날짜·시각 → UTC 'YYYYMMDDTHHMMSSZ' */
function utcStamp(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh - 9, mm));
  return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}T${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}00Z`;
}

/** 75자 넘는 줄 접기 (RFC 5545) */
function fold(line) {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 73) {
      out.push(cur);
      cur = ' ' + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

const alarm = (minutesBefore, text) => [
  'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:-PT${minutesBefore}M`, 'END:VALARM',
];

/**
 * @param g { id, leagueId, date, time, stage, venue }
 * @param home, away 팀 { name, short }
 * @param appUrl 앱 주소 (선택)
 */
export function makeIcs(g, home, away, appUrl = '') {
  const title = `🏀 ${home.short} vs ${away.short}`;
  const league = LEAGUE_LABEL[g.leagueId] || '';
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//court-note//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${g.id}@court-note`,
    `DTSTAMP:${utcStamp(g.date, '09:00')}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc(g.venue)}`,
    `DESCRIPTION:${esc(`${league} ${STAGE_LABEL[g.stage] || ''}\n${home.name} vs ${away.name}${appUrl ? `\n\n코트노트에서 기록하기: ${appUrl}` : ''}`)}`,
  ];
  if (appUrl) lines.push(`URL:${appUrl}`);

  if (/^\d{1,2}:\d{2}$/.test(g.time || '')) {
    const [hh, mm] = g.time.split(':').map(Number);
    const startMin = hh * 60 + mm;
    lines.push(`DTSTART:${utcStamp(g.date, g.time)}`);
    lines.push(`DTEND:${utcStamp(g.date, `${Math.floor((startMin + 120) / 60)}:${p2((startMin + 120) % 60)}`)}`);
    if (startMin - 600 > 60) lines.push(...alarm(startMin - 600, `오늘 ${g.time} ${home.short} vs ${away.short} 경기가 있어요`));
    lines.push(...alarm(60, `1시간 뒤 ${home.short} vs ${away.short} 경기 시작!`));
  } else {
    const next = new Date(`${g.date}T12:00:00`);
    next.setDate(next.getDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${g.date.replaceAll('-', '')}`);
    lines.push(`DTEND;VALUE=DATE:${next.getFullYear()}${p2(next.getMonth() + 1)}${p2(next.getDate())}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
