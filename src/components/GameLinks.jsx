// 경기 관련 링크: 중계 채널 · 하이라이트 영상 · 경기 기록 · 영상/뉴스 검색
// 앱 안에 내용을 가져오지 않고, 공식 페이지·유튜브·네이버로 연결만 합니다.
import { fmtDate } from '../lib/date.js';
import {
  CHANNELS, kblRecordUrl, naverNews, useGameExtra, youtubeSearch, youtubeThumb, youtubeWatch,
} from '../lib/remote.js';

const queryOf = (g) => `${g.home.short} ${g.away.short} ${fmtDate(g.date || '').replace(/\s*\(.*\)/, '')}`;

/** 중계 채널 칩 (달력 일정 목록용, 작게) */
export function ChannelChips({ gameId, finished }) {
  const x = useGameExtra(gameId);
  if (!x) return null;
  return (
    <span className="ch-chips">
      {x.live && !finished && <span className="live-chip">● 진행 중 {x.live[0]}:{x.live[1]}</span>}
      {!finished && x.ch?.map((c) => CHANNELS[c] && <span key={c} className="ch-chip">{CHANNELS[c].name}</span>)}
      {finished && x.hl && <span className="ch-chip hl">▶ 하이라이트</span>}
    </span>
  );
}

/**
 * 기록 상세 · 경기 화면용 전체 링크
 * @param g { id, leagueId, date, home: {short,name}, away, custom }
 */
export default function GameLinks({ g, date, finished }) {
  const x = useGameExtra(g.custom ? null : g.id);
  const q = queryOf({ ...g, date });
  const isKbl = g.leagueId === 'kbl';
  const chans = (x?.ch || []).map((c) => CHANNELS[c]).filter(Boolean);

  return (
    <section className="game-links">
      {x?.hl && (
        <a className="hl-card" href={youtubeWatch(x.hl)} target="_blank" rel="noopener">
          <img src={youtubeThumb(x.hl)} alt="" loading="lazy" />
          <span className="hl-play">▶</span>
          <span className="hl-label">KBL 공식 하이라이트</span>
        </a>
      )}

      {chans.length > 0 && !finished && (
        <div className="link-row">
          <span className="link-k">중계</span>
          <span className="link-v">
            {chans.map((c) =>
              c.url ? (
                <a key={c.name} className="ch-chip link" href={c.url} target="_blank" rel="noopener">{c.name} ↗</a>
              ) : (
                <span key={c.name} className="ch-chip">{c.name}</span>
              )
            )}
          </span>
        </div>
      )}

      <div className="link-btns">
        {isKbl && x?.k && finished && (
          <a className="btn ghost sm" href={kblRecordUrl(x.k, date)} target="_blank" rel="noopener">📊 경기 기록</a>
        )}
        <a className="btn ghost sm" href={youtubeSearch(`${q} ${isKbl ? 'KBL' : '대학농구'} 하이라이트`)} target="_blank" rel="noopener">🎬 관련 영상</a>
        <a className="btn ghost sm" href={naverNews(`${g.home.short} ${g.away.short} ${isKbl ? '농구' : '대학농구'}`)} target="_blank" rel="noopener">📰 관련 뉴스</a>
      </div>
    </section>
  );
}
