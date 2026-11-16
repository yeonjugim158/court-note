import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { BACKUP_REMIND_DAYS, daysSince } from '../lib/backup.js';
import { pad, parseYmd, todayYmd, WEEKDAYS } from '../lib/date.js';
import { resultOf, sortEntries } from '../lib/entry.js';
import { useCoverThumb, useFavGames, useFavTeams, useObjectUrl, useSetting } from '../lib/hooks.js';
import { getLeague, getTeam } from '../data/teams.js';
import { getGames } from '../data/games.js';
import DayPanel from './DayPanel.jsx';

function Cell({ day, ds, entries, isToday, selected, mark, onClick }) {
  const cover = entries.find((e) => e.coverPhotoId) || entries[0];
  const thumb = useCoverThumb(cover);
  const url = useObjectUrl(thumb);
  const modes = new Set(entries.map((e) => e.mode));
  const r = cover ? resultOf(cover) : null;
  const leagues = [...new Set(entries.map((e) => e.game.leagueId))];
  const dow = parseYmd(ds).getDay();

  return (
    <button
      className={'cal-cell' + (entries.length ? ' has' : '') + (url ? ' photo' : '') + (isToday ? ' today' : '') + (selected ? ' sel' : '')}
      style={
        url
          ? { backgroundImage: `url(${url})` }
          : cover
            ? { '--team': cover.game[cover.cheer === 'away' ? 'away' : 'home'].color || 'var(--accent)' }
            : undefined
      }
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${ds}${entries.length ? `, 기록 ${entries.length}개` : ''}${mark?.star ? ', 즐겨찾기 경기' : mark?.color ? ', 응원팀 경기' : ''}`}
    >
      <span className={'cal-day' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '')}>
        {day}
        {mark && (mark.star ? <span className="cal-star">★</span> : <i className="cal-fav" style={{ '--c': mark.color }} />)}
      </span>
      {cover && (
        <>
          <span className="cal-modes">
            {modes.has('live') && <span>🏟️</span>}
            {modes.has('home') && <span>📺</span>}
          </span>
          {!url && (
            <span className="cal-noimg">
              {cover.game.home.short}
              <br />
              {cover.game.away.short}
            </span>
          )}
          <span className="cal-bottom">
            <span className="cal-league">{leagues.map((l) => getLeague(l)?.badge).join('·')}</span>
            {entries.length > 1 && <span className="cal-more">+{entries.length - 1}</span>}
            {r && <i className={'cal-dot r-' + r} />}
          </span>
        </>
      )}
    </button>
  );
}

/** 오래 백업하지 않았으면 달력 위에 알림 */
function BackupBanner({ goSettings }) {
  const lastBackupAt = useSetting('lastBackupAt');
  const snoozeUntil = useSetting('backupSnoozeUntil');
  const count = useLiveQuery(() => db.entries.count(), [], 0);
  const days = daysSince(lastBackupAt);
  if (!count) return null;
  if (days != null && days < BACKUP_REMIND_DAYS) return null;
  if (snoozeUntil && Date.now() < snoozeUntil) return null;
  return (
    <div className="banner">
      <span>💾 {days == null ? `기록 ${count}개를 아직 백업하지 않았어요` : `마지막 백업이 ${days}일 전이에요`}</span>
      <div className="banner-actions">
        <button className="link-btn" onClick={() => setSetting('backupSnoozeUntil', Date.now() + 3 * 86400000)}>나중에</button>
        <button className="btn primary sm" onClick={goSettings}>백업하기</button>
      </div>
    </div>
  );
}

export default function CalendarView({ nav, weekStart = 0, goSettings }) {
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [sel, setSel] = useState(todayYmd());
  const favGames = useFavGames();
  const fav = useFavTeams();
  const touch = useRef(null);

  const start = `${ym.y}-${pad(ym.m + 1)}-01`;
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const end = `${ym.y}-${pad(ym.m + 1)}-${pad(daysInMonth)}`;
  const offset = (new Date(ym.y, ym.m, 1).getDay() - weekStart + 7) % 7;
  const weekOrder = [0, 1, 2, 3, 4, 5, 6].map((i) => (i + weekStart) % 7);

  const entries = useLiveQuery(() => db.entries.where('date').between(start, end, true, true).toArray(), [start, end], []);

  const byDate = useMemo(() => {
    const map = {};
    for (const e of sortEntries(entries)) (map[e.date] ||= []).push(e);
    return map;
  }, [entries]);

  const live = entries.filter((e) => e.mode === 'live');
  const liveRes = live.map(resultOf).filter((r) => r === 'W' || r === 'L');
  const wins = liveRes.filter((r) => r === 'W').length;

  const today = todayYmd();
  // 달 이동: 이번 달이면 오늘, 아니면 1일을 선택
  const goMonth = (y, m) => {
    setYm({ y, m });
    const first = `${y}-${pad(m + 1)}-01`;
    setSel(today.slice(0, 7) === first.slice(0, 7) ? today : first);
  };
  const move = (delta) => {
    const d = new Date(ym.y, ym.m + delta, 1);
    goMonth(d.getFullYear(), d.getMonth());
  };

  // 응원팀 경기(점) · 즐겨찾기 경기(★) 표시
  const markOf = (ds) => {
    const games = [...getGames('kbl', ds), ...getGames('uleague', ds)];
    if (games.some((g) => favGames.includes(g.id))) return { star: true };
    const g = games.find((g) => [g.homeId, g.awayId].includes(fav[g.leagueId]));
    return g ? { color: getTeam(fav[g.leagueId]).color } : null;
  };
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(<div key={'b' + i} className="cal-blank" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
    const list = byDate[ds] || [];
    cells.push(
      <Cell
        key={ds}
        day={d}
        ds={ds}
        entries={list}
        isToday={ds === today}
        selected={ds === sel}
        mark={markOf(ds)}
        onClick={() => setSel(ds)}
      />
    );
  }

  return (
    <section className="page">
      <header className="cal-head">
        <button className="icon-btn" onClick={() => move(-1)} aria-label="이전 달">‹</button>
        <h1>
          {ym.y}년 {ym.m + 1}월
        </h1>
        <button className="icon-btn" onClick={() => move(1)} aria-label="다음 달">›</button>
        <button
          className="today-btn"
          onClick={() => goMonth(now.getFullYear(), now.getMonth())}
        >
          오늘
        </button>
      </header>

      <BackupBanner goSettings={goSettings} />

      <div className="month-summary">
        <div><b>{live.length}</b><span>직관</span></div>
        <div><b>{entries.length - live.length}</b><span>집관</span></div>
        <div>
          <b>{liveRes.length ? Math.round((wins / liveRes.length) * 100) + '%' : '–'}</b>
          <span>직관 승률</span>
        </div>
      </div>

      <div className="cal-week">
        {weekOrder.map((i) => (
          <span key={i} className={i === 0 ? 'sun' : i === 6 ? 'sat' : ''}>{WEEKDAYS[i]}</span>
        ))}
      </div>
      <div
        className="cal-grid"
        onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touch.current == null) return;
          const dx = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(dx) > 60) move(dx < 0 ? 1 : -1);
        }}
      >
        {cells}
      </div>

      <p className="cal-hint muted">★ 즐겨찾기 경기 · <i className="cal-fav inline" /> 응원팀 경기 · 좌우로 밀어 달 이동</p>

      <DayPanel date={sel} nav={nav} />
    </section>
  );
}
