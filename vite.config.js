import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 상대 경로로 빌드 → GitHub Pages(/court-note/)든 루트 도메인이든 그대로 동작
  base: './',
  // 한글 경로(Windows)에서 파일 변경 감지가 누락되는 경우가 있어 polling 사용
  server: { host: true, port: 5173, watch: { usePolling: true, interval: 300 } },
  preview: { host: true, port: 4173 },
});
