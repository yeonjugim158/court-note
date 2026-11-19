// 사진 → 글자 + 글자 위치 (기기 안에서 Tesseract.js로 인식, 사진은 어디에도 보내지 않음)
// 처음 한 번 인식 엔진과 언어 데이터(한국어 약 10MB + 영어 약 4MB)를 jsdelivr CDN에서 받고, 이후엔 기기에 저장된 걸 씀.
//
// 일정표 사진에 맞춘 처리
// - 글자 크기를 맞춤: 먼저 크게 키워 읽고, 글자 높이가 인식에 좋은 크기(약 32px)와 많이 다르면 그 크기로 다시 읽음
//   (작은 표 글자는 키워야, 큰 포스터 글자는 줄여야 잘 읽힘 · iPhone 캔버스 한도 1,600만 화소 안에서)
// - 색칠된 칸(파랑·주황·초록…) 위 검은 글자: 각 픽셀의 가장 밝은 색 채널을 쓰면 배경은 하얘지고 글자만 남음
// - 표 선(긴 가로·세로 줄)은 지움 → 글자로 잘못 읽는 것 방지
// - "흩어진 글자" 모드(PSM 11)로 칸마다 글자를 따로 찾고, 단어 위치를 함께 받음
// - 한글과 영문 약칭(SK·KT…)이 섞인 줄에서 영문이 깨지면 영어 전용으로 한 번 더 읽어 보충
import { createWorker } from 'tesseract.js';

const workers = {};
let progressCb = () => {};

function getWorker(langs) {
  const key = langs.join('+');
  if (!workers[key]) {
    workers[key] = createWorker(langs, 1, { logger: (m) => progressCb(m) })
      .then(async (w) => {
        await w.setParameters({ tessedit_pageseg_mode: '11' });
        return w;
      })
      .catch((e) => {
        delete workers[key];
        throw e;
      });
  }
  return workers[key];
}

const MAX_PIXELS = 15_000_000;

/** 첫 시도 배율: 2.5배 (긴 변 최대 5000px) */
function firstScale(bmp) {
  const long = Math.max(bmp.width, bmp.height);
  return Math.max(Math.min(2.5, 5000 / long), Math.min(1, 5000 / long));
}

/** textH: 원본 기준 글자 높이(알면). 표 선 지우기 기준을 글자보다 충분히 길게 잡아 큰 글자의 획(ㅣ 등)을 지우지 않게 */
async function preprocess(bmp, wantScale, textH = 0) {
  const scale = Math.min(wantScale, Math.sqrt(MAX_PIXELS / (bmp.width * bmp.height)));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const n = w * h;
  const g = new Uint8ClampedArray(n);

  // 가장 밝은 채널 (색 배경 → 흰색) + 어두운 배경(흰 글씨 포스터)이면 반전
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const v = Math.max(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
    g[i] = v;
    sum += v;
  }
  const invert = sum / n < 110;
  for (let i = 0; i < n; i++) {
    let v = invert ? 255 - g[i] : g[i];
    g[i] = (v - 128) * 1.6 + 128; // 대비
  }

  // 표 선 지우기: 원본 기준 가로 60px·세로 25px 넘게 이어진 어두운 줄
  const dark = (v) => v < 110;
  const minH = Math.round(Math.max(60, textH * 4) * scale), minV = Math.round(Math.max(25, textH * 2.2) * scale);
  for (let y = 0; y < h; y++) {
    let run = 0;
    for (let x = 0; x <= w; x++) {
      if (x < w && dark(g[y * w + x])) run++;
      else {
        if (run >= minH) g.fill(255, y * w + x - run, y * w + x);
        run = 0;
      }
    }
  }
  for (let x = 0; x < w; x++) {
    let run = 0;
    for (let y = 0; y <= h; y++) {
      if (y < h && dark(g[y * w + x])) run++;
      else {
        if (run >= minV) for (let r = y - run; r < y; r++) g[r * w + x] = 255;
        run = 0;
      }
    }
  }

  for (let i = 0; i < n; i++) d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g[i];
  ctx.putImageData(img, 0, 0);
  return { canvas: c, scale };
}

const toWords = (data, scale) =>
  (data.words || []).map((w) => ({
    t: w.text,
    x0: w.bbox.x0 / scale,
    x1: w.bbox.x1 / scale,
    y0: w.bbox.y0 / scale,
    y1: w.bbox.y1 / scale,
  }));

let last = null; // { canvas, scale }

/**
 * @param file 이미지 파일
 * @param onProgress ({ stage: 'load'|'read', ratio }) => void
 * @returns 단어 목록 [{ t, x0, x1, y0, y1 }] (원본 사진 좌표)
 */
export async function recognize(file, onProgress = () => {}) {
  progressCb = (m) => {
    if (m.status === 'recognizing text') onProgress({ stage: 'read', ratio: m.progress });
    else if (/loading|initializ/i.test(m.status)) onProgress({ stage: 'load', ratio: m.progress });
  };
  onProgress({ stage: 'load', ratio: 0 });
  const bmp = await createImageBitmap(file);
  try {
    const [worker, prep] = await Promise.all([getWorker(['kor', 'eng']), preprocess(bmp, firstScale(bmp))]);
    let { data } = await worker.recognize(prep.canvas, {}, { blocks: true, text: true });
    last = prep;

    // 글자 높이(처리한 사진 기준) 중간값이 좋은 크기(32px)와 많이 다르면 맞춰서 다시
    const hs = (data.words || []).filter((w) => w.text.trim().length >= 2).map((w) => w.bbox.y1 - w.bbox.y0).sort((a, b) => a - b);
    const h = hs[Math.floor(hs.length / 2)];
    if (h && (h > 48 || h < 20)) {
      const prep2 = await preprocess(bmp, prep.scale * (32 / h), h / prep.scale);
      onProgress({ stage: 'read2', ratio: 0 });
      progressCb = (m) => m.status === 'recognizing text' && onProgress({ stage: 'read2', ratio: m.progress });
      ({ data } = await worker.recognize(prep2.canvas, {}, { blocks: true, text: true }));
      last = prep2;
    }
    return toWords(data, last.scale);
  } finally {
    bmp.close?.();
  }
}

/** 방금 읽은 사진을 영어 전용으로 한 번 더 (영문 팀 약칭 보충용) */
export async function recognizeLatin(onProgress = () => {}) {
  if (!last) return [];
  progressCb = (m) => {
    if (m.status === 'recognizing text') onProgress({ stage: 'latin', ratio: m.progress });
    else if (/loading|initializ/i.test(m.status)) onProgress({ stage: 'load', ratio: m.progress });
  };
  const worker = await getWorker(['eng']);
  const { data } = await worker.recognize(last.canvas, {}, { blocks: true, text: true });
  return toWords(data, last.scale);
}
