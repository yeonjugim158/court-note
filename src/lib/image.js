// 사진을 저장 전에 리사이즈: 원본(긴 변 1600px) + 달력용 정사각 썸네일(320px)

async function decode(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

const toBlob = (canvas, q) =>
  new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('이미지 변환 실패'))), 'image/jpeg', q));

export async function processImage(file) {
  const src = await decode(file);
  const w = src.width, h = src.height;

  const scale = Math.min(1, 1600 / Math.max(w, h));
  const c1 = document.createElement('canvas');
  c1.width = Math.round(w * scale);
  c1.height = Math.round(h * scale);
  c1.getContext('2d').drawImage(src, 0, 0, c1.width, c1.height);
  const blob = await toBlob(c1, 0.85);

  const T = 320;
  const side = Math.min(w, h);
  const c2 = document.createElement('canvas');
  c2.width = T;
  c2.height = T;
  c2.getContext('2d').drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, T, T);
  const thumb = await toBlob(c2, 0.8);

  if (src.close) src.close();
  return { blob, thumb };
}
