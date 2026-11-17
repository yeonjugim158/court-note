// 오늘의 MVP 고르기
// - 끝난 KBL 경기: 실제 출전 선수(경기 기록)를 득점순으로
// - 아직 안 끝난 KBL 경기: 팀 등록 선수 명단
// - 대학·직접 입력 경기, 데이터가 없을 때: 이름 직접 입력
import { useState } from 'react';
import { useBoxScore, useRosters } from '../lib/remote.js';

export default function MvpPicker({ game, cheer, value, player, onChange }) {
  const box = useBoxScore(!game.custom ? game.id : null);
  const rosters = useRosters();
  const sides = ['home', 'away'].filter((s) => game[s]?.id);
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState(cheer === 'away' ? 'away' : 'home');
  const [typing, setTyping] = useState(false);

  const fromBox = !!box;
  const listOf = (s) => {
    if (box) {
      return box[s]
        .filter((p) => p[2]) // 미출전 제외
        .sort((a, b) => b[3] - a[3])
        .map(([no, name, , pts, reb, ast]) => ({ no, name, sub: `${pts}점 ${reb}리바 ${ast}어시` }));
    }
    const r = rosters?.teams?.[game[s].id];
    return r ? r.map(([no, name, pos]) => ({ no, name, sub: pos })) : null;
  };
  const list = sides.length === 2 ? listOf(side) : null;

  // 고를 수 있는 목록이 없으면 직접 입력
  if (!list && !open) {
    return <input value={value} placeholder="선수 이름" onChange={(e) => onChange(e.target.value, null)} />;
  }

  const pick = (p) => {
    onChange(p.name, { teamId: game[side].id, no: p.no, name: p.name });
    setOpen(false);
  };
  const selTeam = player && [game.home, game.away].find((t) => t.id === player.teamId);

  return (
    <div className="mvp">
      <button type="button" className={'mvp-current' + (value ? ' set' : '')} onClick={() => setOpen((o) => !o)}>
        {value ? (
          <>
            <span className="mvp-medal">🏅</span>
            {selTeam && <i className="dot" style={{ background: selTeam.color }} />}
            <b>{player?.no && `#${player.no} `}{value}</b>
            {selTeam && <span className="muted small">{selTeam.short}</span>}
          </>
        ) : (
          <span className="muted">선수 고르기</span>
        )}
        <span className="mvp-chev">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="mvp-panel">
          <div className="seg">
            {sides.map((s) => (
              <button key={s} type="button" className={side === s ? 'on' : ''} onClick={() => setSide(s)}>
                {game[s].short}
              </button>
            ))}
          </div>
          {list ? (
            <ul className="mvp-list">
              {list.map((p) => (
                <li key={p.no + p.name}>
                  <button
                    type="button"
                    className={player?.teamId === game[side].id && player?.name === p.name ? 'on' : ''}
                    onClick={() => pick(p)}
                  >
                    <span className="mvp-no">{p.no}</span>
                    <b>{p.name}</b>
                    <span className="muted small">{p.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted small pad">선수 명단을 불러오지 못했어요.</p>
          )}
          <p className="muted small mvp-src">{fromBox ? '이 경기 출전 선수 · 득점순 (KBL 경기 기록)' : 'KBL 등록 선수 명단'}</p>
          {typing ? (
            <input autoFocus value={value} placeholder="선수 이름" onChange={(e) => onChange(e.target.value, null)} />
          ) : (
            <div className="mvp-actions">
              <button type="button" className="link-btn" onClick={() => setTyping(true)}>목록에 없어요 · 직접 입력</button>
              {value && <button type="button" className="link-btn" onClick={() => { onChange('', null); setOpen(false); }}>선택 해제</button>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
