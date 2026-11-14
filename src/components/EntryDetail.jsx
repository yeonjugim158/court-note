import { useLiveQuery } from 'dexie-react-hooks';
import { db, deleteEntry } from '../lib/db.js';
import { fmtDateFull } from '../lib/date.js';
import { MODES, MOODS, resultOf, hasScore } from '../lib/entry.js';
import { useObjectUrl } from '../lib/hooks.js';
import { STAGES } from '../data/teams.js';
import { LayerHead, LeagueBadge, ResultChip, TeamName } from './ui.jsx';

function Slide({ photo }) {
  const url = useObjectUrl(photo.blob);
  return <div className="slide">{url && <img src={url} alt="" />}</div>;
}

export default function EntryDetail({ entryId, nav }) {
  const entry = useLiveQuery(() => db.entries.get(entryId), [entryId]);
  const photos = useLiveQuery(
    async () => (await db.photos.where('entryId').equals(entryId).toArray()).sort((a, b) => a.order - b.order),
    [entryId],
    []
  );
  if (!entry) return <LayerHead title="" onBack={nav.back} />;

  const g = entry.game;
  const r = resultOf(entry);
  const isLive = entry.mode === 'live';

  const remove = async () => {
    if (!confirm('이 기록을 삭제할까요?\n사진도 함께 삭제되며 되돌릴 수 없어요.')) return;
    await deleteEntry(entryId);
    nav.back();
  };

  const rows = [
    ['오늘의 MVP', entry.mvp],
    ['명장면', entry.highlight],
    ['만족도', entry.mood ? MOODS[entry.mood - 1] : ''],
    isLive ? ['좌석', [entry.seatZone, entry.seatDetail].filter(Boolean).join(' · ')] : ['시청 방법', entry.watchVia],
    [isLive ? '함께 간 사람' : '함께 본 사람', entry.companions],
    [isLive ? '먹거리 · 굿즈' : '야식', entry.food],
  ].filter(([, v]) => v);

  return (
    <>
      <LayerHead
        title={fmtDateFull(entry.date)}
        onBack={nav.back}
        right={<button className="link-btn" onClick={() => nav.editEntry(entryId)}>수정</button>}
      />
      <div className="layer-body detail">
        {photos.length > 0 && (
          <div className="carousel">
            {photos.map((p) => <Slide key={p.id} photo={p} />)}
          </div>
        )}
        {photos.length > 1 && <p className="muted small center">← 밀어서 사진 {photos.length}장 보기 →</p>}

        <section className="scoreboard">
          <div className="sb-meta">
            <span className="mode-tag">{MODES[entry.mode].icon} {MODES[entry.mode].label}</span>
            <LeagueBadge leagueId={g.leagueId} />
            <span className="muted">{STAGES[g.stage]}</span>
            <ResultChip r={r} />
          </div>
          <div className="sb-main">
            <div className="sb-team"><TeamName team={g.home} strong={entry.cheer === 'home'} /><span className="muted small">홈</span></div>
            <div className="sb-score">{hasScore(entry) ? `${entry.score.home} : ${entry.score.away}` : 'vs'}</div>
            <div className="sb-team"><TeamName team={g.away} strong={entry.cheer === 'away'} /><span className="muted small">원정</span></div>
          </div>
          {(g.venue || g.time) && <div className="muted small center">{[g.time, g.venue].filter(Boolean).join(' · ')}</div>}
        </section>

        {entry.diary && <p className="diary">{entry.diary}</p>}

        {rows.length > 0 && (
          <dl className="info-rows">
            {rows.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        )}

        <button className="btn danger block" onClick={remove}>기록 삭제</button>
      </div>
    </>
  );
}
