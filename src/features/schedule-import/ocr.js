// 사진 → 글자 (기기 안에서 Tesseract.js로 인식, 사진은 어디에도 보내지 않음)
// 처음 한 번 인식 엔진과 언어 데이터(한국어 약 10MB + 영어 약 4MB)를 jsdelivr CDN에서 받고, 이후엔 기기에 저장된 걸 씀.
//
// 한글과 영문 약칭(SK·KT·LG·DB·KCC)이 한 줄에 섞이면 한국어 모델이 영문을 자주 깨뜨려서,
// 필요할 때만 영어 전용으로 한 번 더 읽어 영문 팀 이름을 보충합니다.
import { createWorker } from 'tesseract.js';

const workers = {};
let progressCb = () => {};

function getWorker(langs) {
  const key = langs.join('+');
  if (!workers[key]) {
    workers[key] = createWorker(langs, 1, { logger: (m) => progressCb(m) }).catch((e) => {
      delete workers[key];
      throw e;
    });
  }
  return workers[key];
}

/** 인식이 잘 되게: 긴 변 최소 1600px로 키우고(작은 캡처) 최대 2400px, 흑백 + 대비 강화 */
async function preprocess(file) {
  const bmp = await createImageBitmap(file);
  const long = Math.max(bmp.width, bmp.height);
  const scale = Math.min(2400 / long, Math.max(1, 1600 / long));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  // 밝기 평균으로 어두운 배경(흰 글씨 포스터)이면 반전
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  const invert = sum / (d.length / 4) < 110;
  for (let i = 0; i < d.length; i += 4) {
    let y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    if (invert) y = 255 - y;
    y = Math.max(0, Math.min(255, (y - 128) * 1.5 + 128)); // 대비
    d[i] = d[i + 1] = d[i + 2] = y;
  }
  ctx.putImageData(img, 0, 0);
  bmp.close?.();
  return c;
}

const cleanup = (t) => t.replace(/(?<=[가-힣]) (?=[가-힣](?:\s|$))/g, ''); // "고 려 대" → "고려대"

let lastCanvas = null;

/**
 * @param file 이미지 파일
 * @param onProgress ({ stage: 'load'|'read', ratio }) => void
 * @returns 인식한 글자 (한국어+영어)
 */
export async function recognize(file, onProgress = () => {}) {
  progressCb = (m) => {
    if (m.status === 'recognizing text') onProgress({ stage: 'read', ratio: m.progress });
    else if (/loading|initializ/i.test(m.status)) onProgress({ stage: 'load', ratio: m.progress });
  };
  onProgress({ stage: 'load', ratio: 0 });
  const [worker, canvas] = await Promise.all([getWorker(['kor', 'eng']), preprocess(file)]);
  lastCanvas = canvas;
  const { data } = await worker.recognize(canvas);
  return cleanup(data.text);
}

/** 방금 읽은 사진을 영어 전용으로 한 번 더 (영문 팀 약칭 보충용) */
export async function recognizeLatin(onProgress = () => {}) {
  if (!lastCanvas) return '';
  progressCb = (m) => {
    if (m.status === 'recognizing text') onProgress({ stage: 'latin', ratio: m.progress });
    else if (/loading|initializ/i.test(m.status)) onProgress({ stage: 'load', ratio: m.progress });
  };
  const worker = await getWorker(['eng']);
  const { data } = await worker.recognize(lastCanvas);
  return data.text;
}
