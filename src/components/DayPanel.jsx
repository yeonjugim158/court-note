// 달력 아래: 고른 날짜의 내 기록 + 그날 경기 일정
// 경기를 누르면 그 경기로 바로 기록, ☆로 즐겨찾기(달력에 ★ 표시)
import { useLiveQuery } from 'dexie-react-hooks';
import { db, toggleFavGame } from '../lib/db.js';
import { fmtDateFull, todayYmd } from '../lib/date.js';
import { sortEntries } from '../lib/entry.js';
import { useFavGames, useFavTeams } from '../lib/hooks.js';
import { LEAGUES, STAGES, getTeam } from '../data/teams.js';
import { getGames, isFinished } from '../data/games.js';
import { EntryCard, LeagueBadge, TeamName } from './ui.jsx';
import { ChannelChips } from './GameLinks.jsx';
import { deleteMyGame, useMyGamesOn } from '../features/schedule-import/myGames.js';

function GameRow({ g, recorded, starred, upcoming, isFavTeam, nav }) {
  const h = getTeam(g.homeId), a = getTeam(g.awayId);
  const done = isFinished(g);
  return (
    <div className={'day-game' + (starred ? ' starred' : '') + (isFavTeam ? ' fav-team' : '')}>
      <div className="day-game-row">
        <button
          className="day-game-main"
          onClick={() => (recorded ? nav.openEntry(recorded.id) : nav.newEntry(g.date, g.id, g.mine ? g : undefined))}
        >
          <div className="game-top">
            <b>{g.time || '시간 미정'}</b>
            <span>{STAGES[g.stage]}</span>
            <span className="muted ellipsis">{g.venue}</span>
          </div>
          <div className="game-teams">
            <TeamName team={h} />
            <span className="score">{done ? `${g.homeScore} : ${g.awayScore}` : 'vs'}</span>
            <TeamName team={a} />
          </div>
          <span className="day-game-foot">
            <span className={'day-game-cta' + (recorded ? ' done' : '')}>{recorded ? '✓ 기록함 · 보기' : '기록하기 ›'}</span>
            {g.mine ? (
              <span className="ch-chips">
                <span className="ch-chip mine">내 일정</span>
                <span
                  role="button"
                  className="ch-chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('이 경기를 내 일정에서 지울까요?\n(이미 남긴 기록은 지워지지 않아요)')) deleteMyGame(g.id);
                  }}
                >
                  삭제
                </span>
              </span>
            ) : (
              <ChannelChips gameId={g.id} finished={done} />
            )}
          </span>
        </button>
        {upcoming && (
          <button
            className={'star-btn' + (starred ? ' on' : '')}
            onClick={() => toggleFavGame(g.id)}
            aria-pressed={starred}
            aria-label={starred ? '즐겨찾기 해제' : '즐겨찾기'}
          >
            {starred ? '★' : '☆'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function DayPanel({ date, nav }) {
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date], []);
  const favGames = useFavGames();
  const myGames = useMyGamesOn(date);
  const fav = useFavTeams();
  const upcoming = date >= todayYmd();

  const sections = LEAGUES.map((l) => {
    const favId = fav[l.id];
    const games = [...getGames(l.id, date), ...myGames.filter((g) => g.leagueId === l.id)].sort((x, y) => {
      const fx = x.homeId === favId || x.awayId === favId ? 0 : 1;
      const fy = y.homeId === favId || y.awayId === favId ? 0 : 1;
      return fx - fy || (x.time || '').localeCompare(y.time || '');
    });
    return { league: l, favId, games };
  }).filter((s) => s.games.length);

  return (
    <section className="day-panel" aria-label={`${date} 일정`}>
      <div className="day-panel-head">
        <h2>{fmtDateFull(date)}</h2>
        <span className="day-panel-btns">
          <button className="btn ghost sm" onClick={() => nav.importSchedule(date)}>📷 일정</button>
          <button className="btn ghost sm" onClick={() => nav.newEntry(date)}>＋ 기록</button>
        </span>
      </div>

      {entries.length > 0 && (
        <>
          <h3 className="day-sub">내 기록</h3>
          <div className="card-list">
            {sortEntries(entries).map((e) => (
              <EntryCard key={e.id} entry={e} onClick={() => nav.openEntry(e.id)} />
            ))}
          </div>
        </>
      )}

      {sections.map(({ league, favId, games }) => (
        <div key={league.id}>
          <h3 className="day-sub"><LeagueBadge leagueId={league.id} /> {league.name} 경기</h3>
          <div className="game-list">
            {games.map((g) => (
              <GameRow
                key={g.id}
                g={g}
                nav={nav}
                upcoming={upcoming}
                starred={favGames.includes(g.id)}
                isFavTeam={g.homeId === favId || g.awayId === favId}
                recorded={entries.find((e) => e.game?.id === g.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {sections.length === 0 && (
        <p className="muted center day-empty">
          이 날은 등록된 경기가 없어요.
          <br />
          연습경기·D리그 등은 <b>📷 일정</b>으로 일정 사진을 가져오거나
          <br />
          <b>＋ 기록</b>에서 직접 입력할 수 있어요.
        </p>
      )}
    </section>
  );
}
