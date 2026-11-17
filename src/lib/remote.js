// 자동 업데이트가 public/data/ 에 올려 두는 부가 정보를 앱 실행 중에 불러옵니다.
// (앱 코드와 분리되어 있어 데이터만 바뀌어도 화면에 반영되고, 오프라인이면 마지막으로 받은 값을 씀 — sw.js)
import { useEffect, useState } from 'react';

const cache = new Map();

/** ./data/<path> JSON 불러오기 (한 번 받은 건 메모리에 보관). 없으면 null */
export function fetchData(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch(`./data/${path}`, { cache: 'no-cache' })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );
  }
  return cache.get(path);
}

export function useData(path) {
  const [data, setData] = useState(undefined); // undefined = 불러오는 중, null = 없음
  useEffect(() => {
    if (!path) return setData(null);
    let alive = true;
    setData(undefined);
    fetchData(path).then((d) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [path]);
  return data;
}

/** 경기별 부가 정보 { k, ch, hl, live } */
export function useGameExtra(gameId) {
  const all = useData('extra.json');
  return all && gameId ? all[gameId] || null : all === undefined ? undefined : null;
}

/** 끝난 경기 선수 기록 { home: [[번호, 이름, 출전시간, 득점, 리바운드, 어시스트]], away } */
export const useBoxScore = (gameId) => useData(gameId?.startsWith('kbl-') ? `box/${gameId}.json` : null);

/** 팀별 등록 선수 { updatedAt, teams: { sk: [[번호, 이름, 포지션]] } } */
export const useRosters = () => useData('rosters.json');

// ---------- 중계 채널 ----------
// kbl.or.kr 일정 페이지의 채널 로고 코드 → 이름·링크
export const CHANNELS = {
  tving: { name: 'TVING', url: 'https://www.tving.com/', stream: true },
  T36: { name: 'tvN SPORTS' },
  T21: { name: 'IB SPORTS' },
  J: { name: 'JTBC SPORTS' },
  M: { name: 'MBC SPORTS+' },
  T31: { name: 'KBL TV', url: 'https://www.youtube.com/@onkbl/streams', stream: true },
};

// ---------- 바깥 링크 (검색 결과 페이지로 연결만, 내용을 가져오지 않음) ----------
const enc = encodeURIComponent;
export const youtubeSearch = (q) => `https://www.youtube.com/results?search_query=${enc(q)}`;
export const naverNews = (q) => `https://m.search.naver.com/search.naver?where=m_news&sort=1&query=${enc(q)}`;
export const youtubeWatch = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`;
export const kblRecordUrl = (key, date) => `https://www.kbl.or.kr/match/record/${key}/${date.replaceAll('-', '')}`;
