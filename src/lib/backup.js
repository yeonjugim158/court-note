import { db, setSetting } from './db.js';

export const BACKUP_REMIND_DAYS = 14;

/** 마지막 백업 후 지난 일수 (백업한 적 없으면 null) */
export const daysSince = (iso) => (iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null);
import { ymd } from './date.js';

const blobToDataURL = (blob) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
const dataURLToBlob = (url) => fetch(url).then((r) => r.blob());

export async function exportBackup() {
  const [entries, photos, settings] = await Promise.all([
    db.entries.toArray(),
    db.photos.toArray(),
    db.settings.toArray(),
  ]);
  const photosOut = [];
  for (const p of photos) {
    photosOut.push({ ...p, blob: await blobToDataURL(p.blob), thumb: await blobToDataURL(p.thumb) });
  }
  const json = JSON.stringify({ app: 'court-note', version: 1, exportedAt: new Date().toISOString(), entries, photos: photosOut, settings });
  const name = `court-note-backup-${ymd(new Date()).replaceAll('-', '')}.json`;
  const file = new File([json], name, { type: 'application/json' });

  // 아이폰(https)에서는 공유 시트 → "파일에 저장" 가능
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: '코트노트 백업' });
      await setSetting('lastBackupAt', new Date().toISOString());
      return { count: entries.length, method: 'share' };
    } catch (e) {
      if (e.name === 'AbortError') return null;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  await setSetting('lastBackupAt', new Date().toISOString());
  return { count: entries.length, method: 'download' };
}

export async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'court-note' || !Array.isArray(data.entries)) {
    throw new Error('코트노트 백업 파일이 아니에요.');
  }
  const photos = [];
  for (const p of data.photos || []) {
    photos.push({ ...p, blob: await dataURLToBlob(p.blob), thumb: await dataURLToBlob(p.thumb) });
  }
  await db.transaction('rw', db.entries, db.photos, db.settings, async () => {
    await Promise.all([db.entries.clear(), db.photos.clear(), db.settings.clear()]);
    await db.entries.bulkAdd(data.entries);
    await db.photos.bulkAdd(photos);
    await db.settings.bulkAdd(data.settings || []);
  });
  return { count: data.entries.length, photos: photos.length };
}
