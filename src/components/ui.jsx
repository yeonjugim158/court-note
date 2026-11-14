import { getLeague, STAGES } from '../data/teams.js';
import { MODES, RESULT_LABEL, resultOf, hasScore } from '../lib/entry.js';
import { fmtDate } from '../lib/date.js';
import { useCoverThumb, useObjectUrl } from '../lib/hooks.js';

export function LayerHead({ title, onBack, backLabel = '‹', right }) {
  return (
    <header className="layer-head">
      <button className="icon-btn" onClick={onBack} aria-label="뒤로">{backLabel}</button>
      <h2>{title}</h2>
      <div className="layer-head-right">{right}</div>
    </header>
  );
}

export function TeamName({ team, strong }) {
  return (
    <span className={'team' + (strong ? ' strong' : '')}>
      <i className="team-dot" style={{ background: team.color || 'var(--muted)' }} />
      {team.short || team.name}
    </span>
  );
}

export function ResultChip({ r }) {
  if (!r) return null;
  return <span className={'result-chip r-' + r}>{RESULT_LABEL[r]}</span>;
}

export function LeagueBadge({ leagueId }) {
  const l = getLeague(leagueId);
  if (!l) return null;
  return <span className={'league-badge lb-' + leagueId}>{l.badge}</span>;
}

/** 기록 카드 (날짜 시트, 기록 탭에서 공통 사용) */
export function EntryCard({ entry, onClick, showDate }) {
  const thumb = useCoverThumb(entry);
  const url = useObjectUrl(thumb);
  const g = entry.game;
  const r = resultOf(entry);
  return (
    <button className="entry-card" onClick={onClick}>
      <div className="entry-thumb" style={url ? { backgroundImage: `url(${url})` } : { background: g.home.color || 'var(--surface-2)' }}>
        {!url && <span>🏀</span>}
      </div>
      <div className="entry-info">
        <div className="entry-meta">
          <span className="mode-tag">{MODES[entry.mode].icon} {MODES[entry.mode].label}</span>
          <LeagueBadge leagueId={g.leagueId} />
          {showDate && <span className="muted">{fmtDate(entry.date)}</span>}
          <ResultChip r={r} />
        </div>
        <div className="entry-match">
          <TeamName team={g.home} strong={entry.cheer === 'home'} />
          <span className="score">{hasScore(entry) ? `${entry.score.home} : ${entry.score.away}` : 'vs'}</span>
          <TeamName team={g.away} strong={entry.cheer === 'away'} />
        </div>
        <p className="entry-snippet">{entry.diary || (g.stage ? STAGES[g.stage] : '') + (g.venue ? ` · ${g.venue}` : '')}</p>
      </div>
    </button>
  );
}

export function Empty({ icon = '🏀', title, children }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p className="empty-title">{title}</p>
      {children && <p className="muted">{children}</p>}
    </div>
  );
}
