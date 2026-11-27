import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { gameEvent, makeCalendar } from './src/lib/ics.js';
import { TEAMS, getTeam } from './src/data/teams.js';

const APP_URL = 'https://yeonjugim158.github.io/court-note/';

/** 팀마다 구독용 캘린더 ics/team-<팀id>.ics (최근 90일 ~ 앞으로의 경기). 개발 서버에서는 요청 때 바로 만들어 줌 */
function teamCalendars() {
  const load = () => {
    const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
    const byTeam = new Map(TEAMS.map((t) => [t.id, []]));
    for (const leagueId of ['kbl', 'uleague']) {
      const rows = JSON.parse(readFileSync(new URL(`./src/data/schedule/${leagueId}.json`, import.meta.url), 'utf8'));
      for (const [date, time, stage, homeId, awayId, venue, homeScore, awayScore] of rows) {
        if (date < since) continue;
        const g = { id: `${leagueId}-${date}-${homeId}-${awayId}`, leagueId, date, time, stage, venue, homeScore, awayScore };
        const ev = gameEvent(g, getTeam(homeId), getTeam(awayId), APP_URL);
        byTeam.get(homeId)?.push(ev);
        byTeam.get(awayId)?.push(ev);
      }
    }
    const files = new Map();
    for (const t of TEAMS.filter((t) => t.leagueId !== 'national')) files.set(`ics/team-${t.id}.ics`, makeCalendar(`🏀 ${t.short} 경기 · 코트노트`, byTeam.get(t.id)));
    return files;
  };
  return {
    name: 'court-note-team-calendars',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/(ics\/team-[\w-]+\.ics)$/);
        const body = m && load().get(m[1]);
        if (!body) return next();
        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.end(body);
      });
    },
    generateBundle() {
      for (const [fileName, source] of load()) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}

export default defineConfig({
  plugins: [react(), teamCalendars()],
  // 상대 경로로 빌드 → GitHub Pages(/court-note/)든 루트 도메인이든 그대로 동작
  base: './',
  // 한글 경로(Windows)에서 파일 변경 감지가 누락되는 경우가 있어 polling 사용
  server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
  preview: { host: true, port: 4173 },
});
