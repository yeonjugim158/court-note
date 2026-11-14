import Dexie from 'dexie';

// 기기 내 저장소 (IndexedDB). 로그인 없이 이 브라우저/기기에만 저장됩니다.
export const db = new Dexie('court-note');
db.version(1).stores({
  entries: 'id, date, mode, createdAt',
  photos: 'id, entryId',
  settings: 'key',
});

// http(LAN) 접속에서는 crypto.randomUUID가 없으므로 대체 구현 사용
export const uid = () =>
  globalThis.crypto?.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 10);

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key);
  return row ? row.value : fallback;
}
export const setSetting = (key, value) => db.settings.put({ key, value });

/**
 * 기록 저장
 * photos: 화면 순서대로 [{ id, blob, thumb, isNew }]
 */
export async function saveEntry(entry, photos, removedIds) {
  await db.transaction('rw', db.entries, db.photos, async () => {
    await db.entries.put(entry);
    if (removedIds.length) await db.photos.bulkDelete(removedIds);
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.isNew) {
        await db.photos.add({ id: p.id, entryId: entry.id, order: i, blob: p.blob, thumb: p.thumb });
      } else {
        await db.photos.update(p.id, { order: i });
      }
    }
  });
}

export async function deleteEntry(id) {
  await db.transaction('rw', db.entries, db.photos, async () => {
    await db.photos.where('entryId').equals(id).delete();
    await db.entries.delete(id);
  });
}

export async function loadPhotos(entryId) {
  const list = await db.photos.where('entryId').equals(entryId).toArray();
  return list.sort((a, b) => a.order - b.order);
}
