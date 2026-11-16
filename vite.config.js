import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { makeIcs } from './src/lib/ics.js';
import { getTeam } from './src/data/teams.js';

const APP_URL = 'https://yeonjugim158.github.io/court-note/';

/** 경기마다 ics/<경기id>.ics 파일 (아이폰 캘린더 추가용). 개발 서버에서는 요청 때 바로 만들어 줌 */
function gameIcs() {
  const load = () => {
    const files = new Map();
    for (const leagueId of ['kbl', 'uleague']) {
      const rows = JSON.parse(readFileSync(new URL(`./src/data/schedule/${leagueId}.json`, import.meta.url), 'utf8'));
      for (const [date, time, stage, homeId, awayId, venue] of rows) {
        const id = `${leagueId}-${date}-${homeId}-${awayId}`;
        const g = { id, leagueId, date, time, stage, venue };
        files.set(`ics/${id}.ics`, makeIcs(g, getTeam(homeId), getTeam(awayId), APP_URL));
      }
    }
    return files;
  };
  return {
    name: 'court-note-game-ics',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const m = req.url?.match(/\/(ics\/[\w-]+\.ics)$/);
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
  plugins: [react(), gameIcs()],
  // 상대 경로로 빌드 → GitHub Pages(/court-note/)든 루트 도메인이든 그대로 동작
  base: './',
  // 한글 경로(Windows)에서 파일 변경 감지가 누락되는 경우가 있어 polling 사용
  server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
  preview: { host: true, port: 4173 },
});
