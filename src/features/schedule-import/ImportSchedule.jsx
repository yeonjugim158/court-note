// 📷 일정 사진 → 경기 후보 확인 → "내 일정"에 추가
// 이 화면을 열 때만 불러옴 (App.jsx에서 lazy) → 글자 인식 엔진이 앱 첫 화면을 무겁게 하지 않음
import { useEffect, useRef, useState } from 'react';
import { LEAGUES, STAGES, teamsOf, getTeam } from '../../data/teams.js';
import { fmtDate } from '../../lib/date.js';
import { LayerHead } from '../../components/ui.jsx';
import { hasMissingTeams, mergeCandidates, parseSchedule } from './parse.js';
import { groupRows, parseTable, rowsToText } from './layout.js';
import { addMyGames, inOfficial } from './myGames.js';

const blank = (date) => ({ key: `n${Date.now()}`, date: date || '', time: '', homeId: '', awayId: '', leagueId: 'kbl', venue: '', stage: 'regular', on: true });

function TeamSelect({ value, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">팀 선택</option>
      {LEAGUES.map((l) => (
        <optgroup key={l.id} label={l.name}>
          {teamsOf(l.id).map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

function Candidate({ c, onChange, onRemove }) {
  const set = (patch) => {
    const next = { ...c, ...patch };
    const h = getTeam(next.homeId), a = getTeam(next.awayId);
    if (h && a) next.leagueId = h.leagueId;
    if (patch.homeId && h && (!c.venue || c.venue === getTeam(c.homeId)?.venue)) next.venue = h.venue;
    onChange(next);
  };
  const dup = c.date && c.homeId && c.awayId && inOfficial(c);
  const bad = !c.date || !c.homeId || !c.awayId || c.homeId === c.awayId;
  return (
    <div className={'imp-card' + (c.on ? ' on' : '') + (bad ? ' bad' : '')}>
      <div className="imp-top">
        <label className="imp-check">
          <input type="checkbox" checked={c.on} onChange={(e) => set({ on: e.target.checked })} />
          <span>{c.date ? fmtDate(c.date) : '날짜 없음'}</span>
        </label>
        {dup && <span className="imp-tag">공식 일정에 있어요</span>}
        <button className="link-btn" onClick={onRemove} aria-label="후보 삭제">✕</button>
      </div>
      <div className="imp-teams">
        <TeamSelect value={c.homeId} onChange={(v) => set({ homeId: v })} />
        <button className="imp-swap" onClick={() => set({ homeId: c.awayId, awayId: c.homeId })} aria-label="홈·원정 바꾸기">⇄</button>
        <TeamSelect value={c.awayId} onChange={(v) => set({ awayId: v })} />
      </div>
      <div className="imp-row">
        <input type="date" value={c.date} onChange={(e) => set({ date: e.target.value })} />
        <input type="time" value={c.time} onChange={(e) => set({ time: e.target.value })} />
        <select value={c.stage} onChange={(e) => set({ stage: e.target.value })}>
          {Object.entries(STAGES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <input className="imp-venue" value={c.venue} placeholder="경기장" onChange={(e) => set({ venue: e.target.value })} />
      {c.line && <p className="imp-src muted small">인식: “{c.line}”</p>}
    </div>
  );
}

export default function ImportSchedule({ date, onClose }) {
  const [step, setStep] = useState('pick'); // pick → reading → review
  const [imgUrl, setImgUrl] = useState(null);
  const [progress, setProgress] = useState({ stage: 'load', ratio: 0 });
  const [text, setText] = useState('');
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => () => imgUrl && URL.revokeObjectURL(imgUrl), [imgUrl]);

  const [latinText, setLatinText] = useState('');
  const show = (found) => setList(found.map((c) => ({ ...c, on: !inOfficial(c) })));
  // 글자만 고쳐서 다시 찾을 때 (표 위치 정보 없이 줄 단위로)
  const reparse = (t, latin = latinText) => show(mergeCandidates(parseSchedule(t), latin ? parseSchedule(latin) : []));

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setImgUrl(URL.createObjectURL(file));
    setError('');
    setStep('reading');
    try {
      const { recognize, recognizeLatin } = await import('./ocr.js');
      const rows = groupRows(await recognize(file, setProgress));
      const t = rowsToText(rows);
      // 영문 팀 약칭(SK·KT…)이 깨진 줄이 있으면 영어 전용으로 한 번 더
      const latinRows = hasMissingTeams(t) ? groupRows(await recognizeLatin(setProgress).catch(() => [])) : [];
      const latin = rowsToText(latinRows);
      setText(t);
      setLatinText(latin);
      // 표 형식(시간 머리줄 + 날짜 행)이면 칸 위치로, 아니면 줄 단위로
      const table = mergeCandidates(parseTable(rows), parseTable(latinRows));
      show(table.length ? table : mergeCandidates(parseSchedule(t), latin ? parseSchedule(latin) : []));
      setStep('review');
    } catch (err) {
      setError('글자를 읽지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.\n(' + err.message + ')');
      setStep('pick');
    }
  };

  const chosen = list.filter((c) => c.on && c.date && c.homeId && c.awayId && c.homeId !== c.awayId);

  const save = async () => {
    setSaving(true);
    try {
      const n = await addMyGames(chosen);
      alert(`${n}경기를 내 일정에 추가했어요.\n달력에서 날짜를 누르면 보여요.`);
      onClose();
    } catch (err) {
      setSaving(false);
      alert('저장하지 못했어요: ' + err.message);
    }
  };

  return (
    <>
      <LayerHead title="📷 일정 가져오기" onBack={onClose} backLabel="✕" />
      <div className="layer-body imp">
        {step === 'pick' && (
          <>
            <p className="step-sub">일정표·포스터 캡처를 고르면 날짜·시간·팀을 찾아 드려요.</p>
            <button className="imp-pick" onClick={() => fileRef.current?.click()}>
              <span className="imp-pick-icon">🖼️</span>
              <b>사진 고르기</b>
              <span className="muted small">대학농구 U-리그, D리그, 연습경기 일정 등</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
            {error && <p className="warn small pre">{error}</p>}
            <ul className="plain muted small">
              <li>사진은 이 기기 안에서만 읽고 어디에도 보내지 않아요.</li>
              <li>처음 한 번은 글자 인식 데이터(약 10MB)를 받아서 시간이 걸려요. 와이파이에서 해 주세요.</li>
              <li>글자가 크고 또렷한 캡처일수록 잘 읽어요. 일정 부분만 잘라서 올리면 더 정확해요.</li>
              <li>가져온 경기는 이 기기에만 저장되고, 응원팀 캘린더 구독(알림)에는 들어가지 않아요.</li>
            </ul>
            <button className="btn ghost block" onClick={() => { setList([blank(date)]); setStep('review'); }}>사진 없이 직접 입력</button>
          </>
        )}

        {step === 'reading' && (
          <div className="imp-reading">
            {imgUrl && <img src={imgUrl} alt="" className="imp-preview" />}
            <p><b>{progress.stage === 'load' ? '글자 인식 준비 중…' : progress.stage === 'latin' ? '영문 팀 이름 다시 읽는 중…' : progress.stage === 'read2' ? '글자 크기를 맞춰 다시 읽는 중…' : '글자 읽는 중…'}</b></p>
            <div className="imp-bar"><i style={{ width: `${Math.round((progress.ratio || 0) * 100)}%` }} /></div>
            <p className="muted small">{progress.stage === 'load' ? '처음 한 번은 데이터를 받느라 30초~1분 걸릴 수 있어요.' : '사진 크기에 따라 10~30초 걸려요.'}</p>
          </div>
        )}

        {step === 'review' && (
          <>
            {imgUrl && (
              <details className="imp-img">
                <summary>올린 사진 보기</summary>
                <img src={imgUrl} alt="" className="imp-preview" />
              </details>
            )}
            <p className="step-sub">
              {list.length ? `경기 ${list.length}개를 찾았어요. 틀린 곳을 고치고 추가할 경기만 체크하세요.` : '경기를 찾지 못했어요. 아래 "인식한 글자"를 고치거나 직접 추가해 주세요.'}
            </p>
            <div className="imp-list">
              {list.map((c) => (
                <Candidate
                  key={c.key}
                  c={c}
                  onChange={(n) => setList((l) => l.map((x) => (x.key === c.key ? n : x)))}
                  onRemove={() => setList((l) => l.filter((x) => x.key !== c.key))}
                />
              ))}
            </div>
            <button className="btn ghost block" onClick={() => setList((l) => [...l, blank(l[l.length - 1]?.date || date)])}>＋ 경기 직접 추가</button>

            {text && (
              <details className="imp-text">
                <summary>인식한 글자 보기 · 고쳐서 다시 찾기</summary>
                <textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
                <button className="btn ghost sm" onClick={() => reparse(text)}>이 글자로 다시 찾기</button>
              </details>
            )}

            <div className="imp-actions">
              <button className="btn ghost" onClick={() => { setStep('pick'); setList([]); setText(''); setLatinText(''); }}>다른 사진</button>
              <button className="btn primary" disabled={!chosen.length || saving} onClick={save}>
                {chosen.length ? `${chosen.length}경기 내 일정에 추가` : '추가할 경기 없음'}
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
