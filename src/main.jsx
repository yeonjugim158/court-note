import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);

// 저장 데이터가 브라우저에 의해 지워지지 않도록 요청
navigator.storage?.persist?.().catch(() => {});

// 오프라인 지원 (https 배포 시에만 동작)
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
