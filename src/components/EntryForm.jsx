import { useEffect, useRef, useState } from 'react';
import { db, uid, saveEntry, loadPhotos } from '../lib/db.js';
import { fmtDate, fmtDateFull, todayYmd } from '../lib/date.js';
import { processImage } from '../lib/image.js';
import { useFavTeams } from '../lib/hooks.js';
import { MODES, MOODS, SEAT_ZONES, WATCH_VIA } from '../lib/entry.js';
import { LEAGUES, teamsOf, getLeague, stageLabel } from '../data/teams.js';
import { getGame, getGames, isFinished, snapshotGame, checkedAt, fmtUpdated } from '../data/games.js';
import { getTeam, teamOf } from '../data/teams.js';
import { LayerHead, LeagueBadge, TeamName } from './ui.jsx';
import { GameFields } from './GameFields.jsx';
import MvpPicker from './MvpPicker.jsx';

const MAX_PHOTOS = 10;

const blankSide = () => ({ id: null, name: '', short: '', color: null });

export default function EntryForm({ date: initDate, entryId, gameId, presetGame, onClose }) {
  const editing = !!entryId;
  // 달력 일정에서 경기를 눌러 들어온 경우: 직관/집관만 고르면 바로 기록 화면
  const preset = editing ? null : presetGame || (gameId ? getGame(gameId) : null); // presetGame: 사진으로 가져온 내 일정
  const fav = useFavTeams();
  const [step, setStep] = useState(editing ? 'loading' : 'mode');
  const [f, setF] = useState(() => ({
    id: entryId || uid(),
    date: preset?.date || initDate || todayYmd(),
    mode: null,
    leagueId: null,
    game: null,
    cheer: 'none',
    score: { home: '', away: '' },
    diary: '',
    mvp: '',
    mvpPlayer: null,
    highlight: '',
    mood: null,
    seatZone: '',
    seatDetail: '',
    companions: '',
    food: '',
    watchVia: '',
    createdAt: Date.now(),
  }));
  const set = (patch) => setF((p) => ({ ...p, ...patch }));

  const [photos, setPhotos] = useState([]); // { id, blob, thumb, url, isNew }
  const [coverId, setCoverId] = useState(null);
  const [removed, setRemoved] = useState([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const urls = useRef([]);
  const mkUrl = (blob) => {
    const u = URL.createObjectURL(blob);
    urls.current.push(u);
    return u;
  };
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // 수정 모드: 기존 기록 불러오기
  useEffect(() => {
    if (!editing) return;
    (async () => {
      const e = await db.entries.get(entryId);
      if (!e) return onClose();
      const ps = await loadPhotos(entryId);
      setF((p) => ({ ...p, ...e, leagueId: e.game.leagueId }));
      setPhotos(ps.map((p) => ({ id: p.id, blob: p.blob, thumb: p.thumb, url: mkUrl(p.thumb), isNew: false })));
      setCoverId(e.coverPhotoId || ps[0]?.id || null);
      setStep('form');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  const pickGame = (g) => {
    const favId = fav[g.leagueId];
    set({
      game: snapshotGame(g),
      cheer: favId === g.homeId ? 'home' : favId === g.awayId ? 'away' : 'none',
      score: isFinished(g) ? { home: g.homeScore, away: g.awayScore } : { home: '', away: '' },
      ...(f.mvpPlayer && f.game?.id !== g.id && { mvp: '', mvpPlayer: null }), // 다른 경기로 바꾸면 고른 선수 해제
    });
    setStep('form');
  };

  const customGame = (leagueId = f.leagueId) => {
    const national = leagueId === 'national';
    const kor = getTeam('nt-kor');
    set({
      leagueId,
      game: {
        id: null, leagueId, stage: national ? 'intl' : 'regular', time: '', venue: '',
        // 국가대표는 대한민국을 홈·응원팀으로 미리 채움
        home: national ? { id: kor.id, name: kor.name, short: kor.short, color: kor.color } : blankSide(),
        away: blankSide(),
        custom: true,
      },
      cheer: national ? 'home' : 'none',
      score: { home: '', away: '' },
    });
    setStep('form');
  };

  // 직접 입력 경기: GameFields에서 바뀐 값 반영 (팀은 id 또는 직접 입력한 이름)
  const sideOf = (v) => {
    const t = getTeam(v);
    return t ? { id: t.id, name: t.name, short: t.short, color: t.color } : { ...blankSide(), name: v, short: v };
  };
  const setGameFields = ({ home, away, date, ...rest }) => {
    const g0 = f.game;
    const next = { ...g0, ...rest };
    if (home !== undefined) next.home = sideOf(home);
    if (away !== undefined) next.away = sideOf(away);
    const h = getTeam(next.home.id), a = getTeam(next.away.id);
    if (h && (!a || a.leagueId === h.leagueId)) next.leagueId = h.leagueId;
    // 홈팀을 고르면 경기장이 비었거나 이전 홈 경기장일 때 새 홈 경기장으로
    if (home !== undefined && h && (!g0.venue || g0.venue === getTeam(g0.home.id)?.venue)) next.venue = h.venue;
    const favId = fav[next.leagueId];
    const cheer = favId && next.home.id === favId ? 'home' : favId && next.away.id === favId ? 'away' : f.cheer;
    set({ game: next, cheer, ...(date && { date }) });
  };

  const onFiles = async (e) => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    const added = [];
    for (const file of files) {
      try {
        const { blob, thumb } = await processImage(file);
        added.push({ id: uid(), blob, thumb, url: mkUrl(thumb), isNew: true });
      } catch {
        alert(`사진을 불러오지 못했어요: ${file.name}`);
      }
    }
    setPhotos((p) => [...p, ...added]);
    if (!coverId && added[0]) setCoverId(added[0].id);
    setBusy(false);
  };

  const removePhoto = (id) => {
    const rest = photos.filter((p) => p.id !== id);
    const target = photos.find((p) => p.id === id);
    if (target && !target.isNew) setRemoved((r) => [...r, id]);
    setPhotos(rest);
    if (coverId === id) setCoverId(rest[0]?.id || null);
  };

  const save = async () => {
    if (!f.game?.home.name || !f.game?.away.name) return alert('두 팀을 모두 입력해 주세요.');
    setSaving(true);
    const num = (v) => (v === '' || v == null ? null : Number(v));
    const { leagueId, ...rest } = f;
    const entry = {
      ...rest,
      score: { home: num(f.score.home), away: num(f.score.away) },
      coverPhotoId: photos.some((p) => p.id === coverId) ? coverId : photos[0]?.id || null,
      updatedAt: Date.now(),
    };
    try {
      await saveEntry(entry, photos, removed);
      onClose();
    } catch (err) {
      setSaving(false);
      alert('저장하지 못했어요. 저장 공간을 확인해 주세요.\n' + err.message);
    }
  };

  // ---------- 단계별 화면 ----------
  if (step === 'loading') return <LayerHead title="불러오는 중" onBack={onClose} />;

  if (step === 'mode') {
    return (
      <>
        <LayerHead title="어떻게 봤나요?" onBack={onClose} backLabel="✕" />
        <div className="layer-body">
          <p className="step-sub">{fmtDateFull(f.date)}</p>
          {preset && (
            <div className="preset-game">
              <LeagueBadge leagueId={preset.leagueId} />
              <TeamName team={teamOf(preset.homeId)} />
              <span className="muted">vs</span>
              <TeamName team={teamOf(preset.awayId)} />
              <span className="muted small">{preset.time}</span>
            </div>
          )}
          <div className="choice-grid">
            {Object.entries(MODES).map(([k, m]) => (
              <button
                key={k}
                className="choice"
                onClick={() => {
                  if (preset) {
                    set({ mode: k, leagueId: preset.leagueId });
                    pickGame(preset);
                  } else {
                    set({ mode: k });
                    setStep('league');
                  }
                }}
              >
                <span className="choice-icon">{m.icon}</span>
                <b>{m.label}</b>
                <span className="muted">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (step === 'league') {
    return (
      <>
        <LayerHead title="리그 선택" onBack={() => setStep('mode')} />
        <div className="layer-body">
          <p className="step-sub">{MODES[f.mode].icon} {MODES[f.mode].label} · {fmtDate(f.date)}</p>
          <div className="choice-grid">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                className="choice"
                onClick={() => {
                  // 일정 데이터가 없는 리그(국가대표)는 경기 목록 없이 바로 직접 입력
                  if (l.noSchedule) customGame(l.id);
                  else {
                    set({ leagueId: l.id });
                    setStep('game');
                  }
                }}
              >
                <span className={'league-badge big lb-' + l.id}>{l.badge}</span>
                <b>{l.name}</b>
                <span className="muted">{l.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </>
    );
  }

  if (step === 'game') {
    const games = getGames(f.leagueId, f.date);
    return (
      <>
        <LayerHead title="경기 선택" onBack={() => setStep(editing ? 'form' : 'league')} />
        <div className="layer-body">
          <label className="date-row">
            <span>{getLeague(f.leagueId).full}</span>
            <input type="date" value={f.date} onChange={(e) => e.target.value && set({ date: e.target.value })} />
          </label>
          {games.length === 0 && <p className="muted center pad">이 날은 등록된 경기가 없어요.</p>}
          <div className="game-list">
            {games.map((g) => {
              const h = getTeam(g.homeId), a = getTeam(g.awayId);
              const done = isFinished(g);
              return (
                <button key={g.id} className="game-item" onClick={() => pickGame(g)}>
                  <div className="game-top">
                    <span>{g.time}</span>
                    <span>{stageLabel(g.stage)}</span>
                    <span className="muted">{g.venue}</span>
                  </div>
                  <div className="game-teams">
                    <TeamName team={h} />
                    <span className="score">{done ? `${g.homeScore} : ${g.awayScore}` : 'vs'}</span>
                    <TeamName team={a} />
                  </div>
                </button>
              );
            })}
          </div>
          <button className="btn ghost block" onClick={() => customGame()}>목록에 없어요 · 직접 입력</button>
          {checkedAt(f.leagueId) && (
            <p className="muted small center" style={{ marginTop: 10 }}>공식 홈페이지 일정 기준 · {fmtUpdated(checkedAt(f.leagueId))} 확인</p>
          )}
        </div>
      </>
    );
  }

  // step === 'form'
  const g = f.game;
  const isLive = f.mode === 'live';
  return (
    <>
      <LayerHead title={editing ? '기록 수정' : '기록 쓰기'} onBack={() => (editing ? onClose() : setStep(preset && f.game?.id === preset.id ? 'mode' : getLeague(g.leagueId)?.noSchedule ? 'league' : 'game'))} />
      <div className="layer-body form">
        {/* 경기 정보 */}
        <section className="game-card">
          <div className="game-card-top">
            <LeagueBadge leagueId={g.leagueId} />
            <span>{fmtDate(f.date)}</span>
            {g.time && <span>{g.time}</span>}
            <button className="link-btn" onClick={() => setStep('game')}>경기 변경</button>
          </div>
          {g.custom ? (
            <GameFields
              allowCustomTeam
              home={g.home.id || g.home.name}
              away={g.away.id || g.away.name}
              date={f.date}
              time={g.time}
              stage={g.stage}
              venue={g.venue}
              onChange={setGameFields}
            />
          ) : (
            <div className="game-card-teams">
              <TeamName team={g.home} />
              <span className="muted">vs</span>
              <TeamName team={g.away} />
              <div className="muted small full">{stageLabel(g.stage)} · {g.venue}</div>
            </div>
          )}
        </section>

        <Field label="관람 방식">
          <div className="seg">
            {Object.entries(MODES).map(([k, m]) => (
              <button key={k} className={f.mode === k ? 'on' : ''} onClick={() => set({ mode: k })}>{m.icon} {m.label}</button>
            ))}
          </div>
        </Field>

        <Field label="응원팀">
          <div className="seg">
            <button className={f.cheer === 'home' ? 'on' : ''} onClick={() => set({ cheer: 'home' })} disabled={!g.home.name}>{g.home.short || '홈'}</button>
            <button className={f.cheer === 'away' ? 'on' : ''} onClick={() => set({ cheer: 'away' })} disabled={!g.away.name}>{g.away.short || '원정'}</button>
            <button className={f.cheer === 'none' ? 'on' : ''} onClick={() => set({ cheer: 'none' })}>중립</button>
          </div>
        </Field>

        <Field label="최종 스코어">
          <div className="score-input">
            <span>{g.home.short || '홈'}</span>
            <input inputMode="numeric" pattern="[0-9]*" value={f.score.home ?? ''} placeholder="-" onChange={(e) => set({ score: { ...f.score, home: e.target.value.replace(/\D/g, '') } })} />
            <span>:</span>
            <input inputMode="numeric" pattern="[0-9]*" value={f.score.away ?? ''} placeholder="-" onChange={(e) => set({ score: { ...f.score, away: e.target.value.replace(/\D/g, '') } })} />
            <span>{g.away.short || '원정'}</span>
          </div>
        </Field>

        <Field label={`사진 ${photos.length}/${MAX_PHOTOS}`} hint="사진을 누르면 달력 대표 사진이 돼요">
          <div className="photo-grid">
            {photos.map((p) => (
              <div key={p.id} className={'photo-tile' + (p.id === coverId ? ' cover' : '')} style={{ backgroundImage: `url(${p.url})` }} onClick={() => setCoverId(p.id)}>
                {p.id === coverId && <span className="cover-tag">대표</span>}
                <button className="photo-del" onClick={(e) => { e.stopPropagation(); removePhoto(p.id); }} aria-label="사진 삭제">✕</button>
              </div>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="photo-add">
                <input type="file" accept="image/*" multiple onChange={onFiles} hidden />
                {busy ? '처리 중…' : '＋ 사진'}
              </label>
            )}
          </div>
        </Field>

        <Field label={isLive ? '직관 일기' : '집관 일기'}>
          <textarea rows={6} value={f.diary} placeholder="오늘 경기는 어땠나요?" onChange={(e) => set({ diary: e.target.value })} />
        </Field>

        <Field label="오늘의 MVP">
          <MvpPicker
            game={g}
            cheer={f.cheer}
            value={f.mvp}
            player={f.mvpPlayer}
            onChange={(mvp, mvpPlayer) => set({ mvp, mvpPlayer })}
          />
        </Field>

        <div>
          <Field label="만족도">
            <div className="moods">
              {MOODS.map((m, i) => (
                <button key={i} className={f.mood === i + 1 ? 'on' : ''} onClick={() => set({ mood: f.mood === i + 1 ? null : i + 1 })}>{m}</button>
              ))}
            </div>
          </Field>
        </div>

        <Field label="명장면">
          <input value={f.highlight} placeholder="예) 4쿼터 버저비터 3점슛" onChange={(e) => set({ highlight: e.target.value })} />
        </Field>

        {isLive ? (
          <Field label="좌석">
            <div className="chips">
              {SEAT_ZONES.map((z) => (
                <button key={z} className={f.seatZone === z ? 'on' : ''} onClick={() => set({ seatZone: f.seatZone === z ? '' : z })}>{z}</button>
              ))}
            </div>
            <input value={f.seatDetail} placeholder="구역 · 열 · 번호" onChange={(e) => set({ seatDetail: e.target.value })} />
          </Field>
        ) : (
          <Field label="시청 방법">
            <div className="chips">
              {WATCH_VIA.map((w) => (
                <button key={w} className={f.watchVia === w ? 'on' : ''} onClick={() => set({ watchVia: f.watchVia === w ? '' : w })}>{w}</button>
              ))}
            </div>
          </Field>
        )}

        <Field label={isLive ? '함께 간 사람' : '함께 본 사람'}>
          <input value={f.companions} placeholder="혼자 / 친구 이름" onChange={(e) => set({ companions: e.target.value })} />
        </Field>
        <Field label={isLive ? '먹거리 · 굿즈' : '야식'}>
          <input value={f.food} placeholder={isLive ? '예) 치킨, 유니폼' : '예) 떡볶이'} onChange={(e) => set({ food: e.target.value })} />
        </Field>
      </div>
      <div className="save-bar">
        <button className="btn primary block" onClick={save} disabled={saving || busy}>
          {saving ? '저장 중…' : '저장하기'}
        </button>
      </div>
    </>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="field">
      <div className="field-label">
        {label}
        {hint && <span className="muted small"> · {hint}</span>}
      </div>
      {children}
    </div>
  );
}
