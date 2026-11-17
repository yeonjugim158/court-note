// 소식 탭: KBL 공식 하이라이트 영상 + 응원팀 뉴스·영상 바로가기
// 하이라이트 목록은 자동 업데이트가 kbl.or.kr 하이라이트에서 가져온 유튜브 영상(extra.json)
// 뉴스·영상은 네이버 뉴스·유튜브 검색 결과로 연결만 합니다.
import { useState } from 'react';
import { useFavTeams } from '../lib/hooks.js';
import { fmtDate } from '../lib/date.js';
import { getTeam } from '../data/teams.js';
import { getGame } from '../data/games.js';
import { naverNews, useData, youtubeSearch, youtubeThumb, youtubeWatch } from '../lib/remote.js';
import { Empty } from './ui.jsx';

function Highlights({ favId }) {
  const extra = useData('extra.json');
  const [pick, setOnlyFav] = useState(null); // null = 응원팀이 있으면 응원팀만
  const onlyFav = pick ?? !!favId;
  if (extra === undefined) return <p className="muted small pad">불러오는 중…</p>;

  const list = Object.entries(extra || {})
    .filter(([, x]) => x.hl)
    .map(([id, x]) => ({ g: getGame(id), hl: x.hl }))
    .filter(({ g }) => g && (!onlyFav || g.homeId === favId || g.awayId === favId))
    .sort((a, b) => b.g.date.localeCompare(a.g.date))
    .slice(0, 12);

  return (
    <>
      <div className="news-head">
        <h3>🎬 KBL 공식 하이라이트</h3>
        {favId && (
          <div className="seg sm">
            <button className={onlyFav ? 'on' : ''} onClick={() => setOnlyFav(true)}>{getTeam(favId).short}</button>
            <button className={!onlyFav ? 'on' : ''} onClick={() => setOnlyFav(false)}>전체</button>
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <p className="muted small pad">아직 하이라이트가 없어요. 경기가 끝나고 공식 영상이 올라오면 여기에 보여요.</p>
      ) : (
        <div className="hl-grid">
          {list.map(({ g, hl }) => {
            const h = getTeam(g.homeId), a = getTeam(g.awayId);
            return (
              <a key={g.id} className="hl-item" href={youtubeWatch(hl)} target="_blank" rel="noopener">
                <span className="hl-thumb">
                  <img src={youtubeThumb(hl)} alt="" loading="lazy" />
                  <span className="hl-play">▶</span>
                </span>
                <b>{h.short} {g.homeScore}:{g.awayScore} {a.short}</b>
                <span className="muted small">{fmtDate(g.date)}</span>
              </a>
            );
          })}
        </div>
      )}
    </>
  );
}

function LinkCard({ href, icon, title, sub }) {
  return (
    <a className="link-card" href={href} target="_blank" rel="noopener">
      <span className="link-card-icon">{icon}</span>
      <span>
        <b>{title}</b>
        <span className="muted small">{sub}</span>
      </span>
      <span className="muted">↗</span>
    </a>
  );
}

export default function NewsView() {
  const fav = useFavTeams();
  const kblTeam = getTeam(fav.kbl);
  const uTeam = getTeam(fav.uleague);

  return (
    <section className="page">
      <header className="page-head"><h1>소식</h1></header>

      <div className="panel">
        <Highlights favId={fav.kbl} />
      </div>

      <div className="panel">
        <h3>📰 뉴스</h3>
        <div className="link-cards">
          {kblTeam && <LinkCard href={naverNews(kblTeam.name)} icon="🏀" title={`${kblTeam.short} 최신 뉴스`} sub="네이버 뉴스 · 최신순" />}
          <LinkCard href={naverNews('KBL 프로농구')} icon="🏆" title="KBL 프로농구 뉴스" sub="네이버 뉴스 · 최신순" />
          {uTeam && <LinkCard href={naverNews(`${uTeam.name} 농구`)} icon="🎓" title={`${uTeam.short} 농구부 뉴스`} sub="네이버 뉴스 · 최신순" />}
          <LinkCard href={naverNews('대학농구 U-리그')} icon="🎓" title="대학농구 뉴스" sub="네이버 뉴스 · 최신순" />
        </div>
      </div>

      <div className="panel">
        <h3>📺 영상 · 공식 채널</h3>
        <div className="link-cards">
          {kblTeam && <LinkCard href={youtubeSearch(`${kblTeam.name}`)} icon="🎬" title={`${kblTeam.short} 영상`} sub="유튜브 검색" />}
          <LinkCard href="https://www.youtube.com/@onkbl" icon="▶️" title="KBL TV" sub="KBL 공식 유튜브" />
          <LinkCard href="https://www.kbl.or.kr/match/schedule" icon="📅" title="KBL 일정 및 결과" sub="kbl.or.kr" />
          <LinkCard href="https://www.tving.com/" icon="📡" title="TVING" sub="KBL 생중계 (유료)" />
        </div>
      </div>

      {!kblTeam && !uTeam && (
        <Empty icon="⭐" title="응원팀을 골라 보세요">설정에서 응원팀을 고르면 그 팀 소식이 먼저 보여요.</Empty>
      )}
    </section>
  );
}
