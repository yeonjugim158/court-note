// 팀별 구독 캘린더(.ics)
// 빌드 때(vite.config.js) 팀마다 ics/team-<팀id>.ics 로 만들어 두고,
// 앱 설정에서 webcal:// 링크로 구독합니다. (홈 화면 앱에서도 아이폰 "구독" 창이 바로 뜸)
// 일정이 바뀌거나 결과가 나오면 다음 빌드 때 파일이 갱신되고, 아이폰이 주기적으로 다시 받아 갑니다.
// 알림: 경기 1일 전 · 1시간 전 · 10분 전

const STAGE_LABEL = {
  preseason: '오픈매치데이', regular: '정규리그', po: '플레이오프', final: '챔피언결정전',
  semi: '플레이오프 4강', ufinal: '플레이오프 결승', cup: '컵대회', allstar: '올스타전',
};
const LEAGUE_LABEL = { kbl: 'KBL', uleague: 'U-리그' };

const esc = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
const p2 = (n) => String(n).padStart(2, '0');
const enc = new TextEncoder();

/** KST 날짜·시각 → UTC 'YYYYMMDDTHHMMSSZ' (24시 넘는 값도 자동 보정) */
function utcStamp(date, hh, mm) {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d, hh - 9, mm));
  return `${t.getUTCFullYear()}${p2(t.getUTCMonth() + 1)}${p2(t.getUTCDate())}T${p2(t.getUTCHours())}${p2(t.getUTCMinutes())}00Z`;
}

/** 75바이트 넘는 줄 접기 (RFC 5545) */
function fold(line) {
  const out = [];
  let cur = '';
  for (const ch of line) {
    if (enc.encode(cur + ch).length > 73) {
      out.push(cur);
      cur = ' ' + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n');
}

const alarm = (trigger, text) => [
  'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(text)}`, `TRIGGER:${trigger}`, 'END:VALARM',
];

/**
 * 경기 1개 → VEVENT 줄 목록
 * @param g { id, leagueId, date, time, stage, venue, homeScore, awayScore }
 */
export function gameEvent(g, home, away, appUrl = '') {
  const done = g.homeScore != null && g.awayScore != null;
  const title = done
    ? `🏀 ${home.short} ${g.homeScore}:${g.awayScore} ${away.short}`
    : `🏀 ${home.short} vs ${away.short}`;
  const lines = [
    'BEGIN:VEVENT',
    `UID:${g.id}@court-note`,
    `DTSTAMP:${utcStamp(g.date, 9, 0)}`,
    `SUMMARY:${esc(title)}`,
    `LOCATION:${esc(g.venue)}`,
    `DESCRIPTION:${esc(
      `${LEAGUE_LABEL[g.leagueId] || ''} ${STAGE_LABEL[g.stage] || ''}\n${home.name} vs ${away.name}` +
        (done ? `\n최종 ${g.homeScore} : ${g.awayScore}` : '') +
        (appUrl ? `\n\n코트노트에서 기록하기: ${appUrl}` : '')
    )}`,
  ];
  if (appUrl) lines.push(`URL:${appUrl}`);

  const m = /^(\d{1,2}):(\d{2})$/.exec(g.time || '');
  if (m) {
    const hh = Number(m[1]), mm = Number(m[2]);
    lines.push(`DTSTART:${utcStamp(g.date, hh, mm)}`, `DTEND:${utcStamp(g.date, hh + 2, mm)}`);
    if (!done) {
      const vs = `${home.short} vs ${away.short}`;
      lines.push(
        ...alarm('-P1D', `내일 ${g.time} ${vs} 경기가 있어요`),
        ...alarm('-PT1H', `1시간 뒤 ${vs} 경기 시작!`),
        ...alarm('-PT10M', `10분 뒤 ${vs} 팁오프!`)
      );
    }
  } else {
    const next = new Date(`${g.date}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(
      `DTSTART;VALUE=DATE:${g.date.replaceAll('-', '')}`,
      `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll('-', '')}`
    );
  }
  lines.push('END:VEVENT');
  return lines;
}

/** 여러 경기 → 구독용 캘린더 파일 */
export function makeCalendar(name, events) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//court-note//KO', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Asia/Seoul',
    'REFRESH-INTERVAL;VALUE=DURATION:PT3H',
    'X-PUBLISHED-TTL:PT3H',
    ...events.flat(),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
