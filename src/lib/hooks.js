import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db.js';

/** Blob → 화면 표시용 URL (자동 해제) */
export function useObjectUrl(blob) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** 응원팀 설정 { kbl: teamId|null, uleague: teamId|null } */
export function useFavTeams() {
  return useLiveQuery(async () => (await db.settings.get('fav'))?.value || { kbl: null, uleague: null }, [], {
    kbl: null,
    uleague: null,
  });
}

export const DEFAULT_PREFS = { theme: 'system', weekStart: 0, teamAccent: true };

/** 화면 설정 { theme: 'system'|'light'|'dark', weekStart: 0(일)|1(월), teamAccent: boolean } */
export function usePrefs() {
  return useLiveQuery(
    async () => ({ ...DEFAULT_PREFS, ...((await db.settings.get('prefs'))?.value || {}) }),
    [],
    DEFAULT_PREFS
  );
}

/** 단일 설정값 (없으면 fallback) */
export function useSetting(key, fallback = null) {
  return useLiveQuery(async () => (await db.settings.get(key))?.value ?? fallback, [key], fallback);
}

/** 기록의 대표 사진 썸네일 Blob */
export function useCoverThumb(entry) {
  return useLiveQuery(async () => {
    if (!entry) return null;
    let p = entry.coverPhotoId ? await db.photos.get(entry.coverPhotoId) : null;
    if (!p) {
      const list = await db.photos.where('entryId').equals(entry.id).toArray();
      p = list.sort((a, b) => a.order - b.order)[0];
    }
    return p ? p.thumb : null;
  }, [entry?.id, entry?.coverPhotoId, entry?.updatedAt]);
}
