// 경기 정보 입력 칸 (기록 쓰기 "직접 입력"과 📷 일정 가져오기가 같이 씀)
// - TeamSelect: 리그별 팀 목록 (+ 필요하면 직접 입력)
// - VenueSelect: KBL 경기장 · U-리그 1부 대학 · 대회 경기장 + 직접 입력
// - StageSelect(단계)는 ui.jsx
import { useState } from 'react';
import { EXTRA_TEAMS, LEAGUES, teamsOf, getTeam } from '../data/teams.js';
import { KBL_VENUES } from '../data/games.js';
import { StageSelect } from './ui.jsx';

/** 경기장 목록 */
export const VENUE_GROUPS = [
  { label: 'KBL 경기장', venues: [...new Set([...KBL_VENUES.map((v) => v.venue), ...teamsOf('kbl').map((t) => t.venue)])].filter(Boolean) },
  { label: '대학농구 U-리그 1부', venues: teamsOf('uleague').map((t) => t.venue) },
  { label: '대회 경기장', venues: ['경희대 선승관', '상주실내체육관 (신관)', '상주실내체육관 (구관)'] },
];
const ALL_VENUES = new Set(VENUE_GROUPS.flatMap((g) => g.venues));

/** 목록 + "직접 입력…"이 있는 고르기 칸. 값이 목록에 없으면 글자 칸으로 보여 줌 */
function PickOrType({ value, onChange, known, placeholder, typePlaceholder, children, className = '' }) {
  const [typingState, setTyping] = useState(false);
  const typing = typingState || (!!value && !known(value));
  if (typing) {
    return (
      <div className={'stage-custom ' + className}>
        <input autoFocus={!value} value={value} placeholder={typePlaceholder} onChange={(e) => onChange(e.target.value)} />
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setTyping(false);
            onChange('');
          }}
        >
          목록
        </button>
      </div>
    );
  }
  return (
    <select
      className={className}
      value={known(value) ? value : ''}
      onChange={(e) => {
        if (e.target.value === '__custom') {
          setTyping(true);
          onChange('');
        } else onChange(e.target.value);
      }}
    >
      <option value="">{placeholder}</option>
      {children}
      <option value="__custom">직접 입력…</option>
    </select>
  );
}

export function VenueSelect({ value, onChange, className = '' }) {
  return (
    <PickOrType
      className={className}
      value={value || ''}
      onChange={onChange}
      known={(v) => ALL_VENUES.has(v)}
      placeholder="경기장 선택"
      typePlaceholder="경기장 이름"
    >
      {VENUE_GROUPS.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.venues.map((v) => <option key={v} value={v}>{v}</option>)}
        </optgroup>
      ))}
    </PickOrType>
  );
}

/**
 * 팀 고르기
 * value: 팀 id (목록 팀) 또는 직접 입력한 이름
 * allowCustom: "직접 입력…" 허용 (기록 쓰기). 일정 가져오기는 목록 팀만.
 */
export function TeamSelect({ value, onChange, allowCustom = false, className = '' }) {
  const options = [
    ...LEAGUES.map((l) => (
      <optgroup key={l.id} label={l.name}>
        {teamsOf(l.id).map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
      </optgroup>
    )),
    <optgroup key="extra" label="D리그 · 기타">
      {EXTRA_TEAMS.map((t) => <option key={t.id} value={t.id}>{t.short}</option>)}
    </optgroup>,
  ];
  if (!allowCustom) {
    return (
      <select className={className} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">팀 선택</option>
        {options}
      </select>
    );
  }
  return (
    <PickOrType className={className} value={value || ''} onChange={onChange} known={(v) => !!getTeam(v)} placeholder="팀 선택" typePlaceholder="팀 이름">
      {options}
    </PickOrType>
  );
}

/**
 * 경기 정보 입력 묶음 (두 화면 공통 모양)
 *   [홈팀 ▾] ⇄ [원정팀 ▾]
 *   [날짜]      [시간]
 *   [단계 ▾]
 *   [경기장 ▾]
 * home/away: 팀 id 또는 직접 입력한 이름 · onChange(바뀐 값들)
 */
export function GameFields({ home, away, date, time, stage, venue, onChange, allowCustomTeam = false }) {
  return (
    <div className="gf">
      <div className="gf-teams">
        <TeamSelect value={home} allowCustom={allowCustomTeam} onChange={(v) => onChange({ home: v })} />
        <button type="button" className="gf-swap" onClick={() => onChange({ home: away, away: home })} aria-label="홈·원정 바꾸기">⇄</button>
        <TeamSelect value={away} allowCustom={allowCustomTeam} onChange={(v) => onChange({ away: v })} />
      </div>
      <div className="gf-row">
        <input type="date" value={date || ''} aria-label="날짜" onChange={(e) => e.target.value && onChange({ date: e.target.value })} />
        <input type="time" value={time || ''} aria-label="경기 시간" onChange={(e) => onChange({ time: e.target.value })} />
      </div>
      <StageSelect value={stage} onChange={(v) => onChange({ stage: v })} />
      <VenueSelect value={venue} onChange={(v) => onChange({ venue: v })} />
    </div>
  );
}
