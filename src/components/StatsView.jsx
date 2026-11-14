import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { resultOf } from '../lib/entry.js';
import { KBL_VENUES } from '../data/games.js';
import { Empty } from './ui.jsx';

function record(list) {
  const rs = list.map(resultOf);
  const w = rs.filter((r) => r === 'W').length;
  const l = rs.filter((r) => r === 'L').length;
  return { w, l, rate: w + l ? Math.round((w / (w + l)) * 100) : null };
}

function top(list, keyFn, n = 5) {
  const m = new Map();
  for (const e of list) {
    const k = keyFn(e);
    if (k) m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export default function StatsView() {
  const all = useLiveQuery(() => db.entries.toArray(), [], []);
  const years = [...new Set(all.map((e) => e.date.slice(0, 4)))].sort().reverse();
  const [year, setYear] = useState('all');
  const list = year === 'all' ? all : all.filter((e) => e.date.startsWith(year));

  const live = list.filter((e) => e.mode === 'live');
  const liveRec = record(live);
  const allRec = record(list);
  const kblVenues = KBL_VENUES.map((v) => ({ ...v, n: live.filter((e) => e.game.venue === v.venue).length }));
  const visited = kblVenues.filter((v) => v.n > 0).length;
  const otherVenues = top(live.filter((e) => !kblVenues.some((v) => v.venue === e.game.venue)), (e) => e.game.venue, 10);
  const mvps = top(list, (e) => e.mvp?.trim());
  const cheered = top(list, (e) => (e.cheer === 'home' || e.cheer === 'away' ? e.game[e.cheer].short : null), 3);

  return (
    <section className="page">
      <header className="page-head"><h1>통계</h1></header>
      <div className="chips scroll">
        <button className={year === 'all' ? 'on' : ''} onClick={() => setYear('all')}>전체 기간</button>
        {years.map((y) => (
          <button key={y} className={year === y ? 'on' : ''} onClick={() => setYear(y)}>{y}년</button>
        ))}
      </div>

      {list.length === 0 ? (
        <Empty icon="📊" title="통계를 보려면 기록이 필요해요" />
      ) : (
        <>
          <div className="stat-tiles">
            <div className="tile"><span>전체 관람</span><b>{list.length}</b></div>
            <div className="tile"><span>🏟️ 직관</span><b>{live.length}</b></div>
            <div className="tile"><span>📺 집관</span><b>{list.length - live.length}</b></div>
          </div>

          <div className="panel">
            <h3>내가 가면 이긴다?</h3>
            <div className="rate-row">
              <div>
                <span className="muted small">직관 승률</span>
                <b className="big">{liveRec.rate == null ? '–' : liveRec.rate + '%'}</b>
                <span className="muted small">{liveRec.w}승 {liveRec.l}패</span>
              </div>
              <div>
                <span className="muted small">전체 승률 (집관 포함)</span>
                <b className="big">{allRec.rate == null ? '–' : allRec.rate + '%'}</b>
                <span className="muted small">{allRec.w}승 {allRec.l}패</span>
              </div>
            </div>
            {liveRec.rate != null && (
              <div className="bar"><i style={{ width: liveRec.rate + '%' }} /></div>
            )}
            <p className="muted small">응원팀을 고르고 스코어를 입력한 경기만 집계돼요.</p>
          </div>

          <div className="panel">
            <h3>KBL 구장 도장깨기 <span className="muted">{visited}/{kblVenues.length}</span></h3>
            <ul className="stamp-list">
              {kblVenues.map((v) => (
                <li key={v.venue} className={v.n ? 'done' : ''}>
                  <span className="dots">{v.teams.map((t) => <i key={t.id} className="team-dot" style={{ background: t.color }} title={t.short} />)}</span>
                  <span>{v.venue}</span>
                  <span className="stamp">{v.n ? `✓ ${v.n}회` : ''}</span>
                </li>
              ))}
            </ul>
            {otherVenues.length > 0 && (
              <>
                <h4>그 외 방문한 경기장</h4>
                <ul className="stamp-list">
                  {otherVenues.map(([v, n]) => (
                    <li key={v} className="done"><span>{v}</span><span className="stamp">✓ {n}회</span></li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {cheered.length > 0 && (
            <div className="panel">
              <h3>가장 많이 응원한 팀</h3>
              <ol className="rank">{cheered.map(([k, n]) => <li key={k}><span>{k}</span><b>{n}경기</b></li>)}</ol>
            </div>
          )}

          {mvps.length > 0 && (
            <div className="panel">
              <h3>내가 뽑은 MVP</h3>
              <ol className="rank">{mvps.map(([k, n]) => <li key={k}><span>{k}</span><b>{n}회</b></li>)}</ol>
            </div>
          )}
        </>
      )}
    </section>
  );
}
