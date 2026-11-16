import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, setSetting } from '../lib/db.js';
import { useFavTeams, usePrefs, useSetting } from '../lib/hooks.js';
import { exportBackup, importBackup, daysSince, BACKUP_REMIND_DAYS } from '../lib/backup.js';
import { LEAGUES, teamsOf, getTeam } from '../data/teams.js';
import { SCHEDULE_META, fmtUpdated, checkedAt } from '../data/games.js';

const APP_VERSION = '0.2';

const HELP = [
  ['기록은 어떻게 남겨요?', '달력에서 날짜를 누르면 아래에 그날 경기가 나와요. 경기를 누르고 직관/집관만 고르면 팀·경기장·스코어가 자동으로 채워져요. 목록에 없는 경기는 "＋ 기록"에서 직접 입력하세요.'],
  ['경기 즐겨찾기와 알림은요?', '앞으로 열릴 경기의 ☆을 누르면 즐겨찾기가 되고 달력에 ★로 표시돼요. "아이폰 캘린더에 추가"를 누르면 캘린더 앱에 경기가 들어가고, 당일 오전 10시와 경기 1시간 전에 알림이 와요. 즐겨찾기를 풀어도 캘린더 일정은 캘린더 앱에서 직접 지워야 해요.'],
  ['달력 대표 사진은 어떻게 바꿔요?', '기록 수정 화면의 사진 칸에서 원하는 사진을 한 번 누르면 "대표"로 바뀌어요. 하루에 경기가 여러 개면 첫 번째 기록의 대표 사진이 달력에 보여요.'],
  ['기록을 고치거나 지우고 싶어요', '기록을 열고 오른쪽 위 "수정"을 누르세요. 삭제는 기록 화면 맨 아래에 있어요. 삭제하면 사진도 함께 지워지고 되돌릴 수 없어요.'],
  ['목록에 경기가 없어요', 'D리그·EASL·올스타전, 연습경기는 일정에 없어요. 경기 선택 화면의 "목록에 없어요 · 직접 입력"으로 팀과 경기장을 직접 적어 주세요.'],
  ['경기 중에 기록하면 스코어는요?', '스코어를 비워 두고 저장하세요. 경기가 끝나고 일정에 결과가 들어오면, 앱을 다시 열 때 최종 스코어가 자동으로 채워져요. 직접 적은 스코어는 바꾸지 않아요. (직접 입력한 경기는 제외)'],
  ['승률은 어떻게 계산돼요?', '응원팀을 고르고 스코어가 있는 경기만 계산해요. "중립"으로 기록한 경기는 승률에서 빠져요.'],
  ['기록이 사라질 수도 있나요?', '기록은 이 아이폰의 사파리 안에만 저장돼요. 사파리 방문 기록·웹사이트 데이터를 지우거나, 홈 화면 앱을 삭제하면 기록도 사라져요. 정기적으로 "백업 내보내기"를 해 두세요.'],
  ['새 폰으로 옮기고 싶어요', '지금 폰에서 "백업 내보내기"로 파일을 아이클라우드 드라이브에 저장하고, 새 폰에서 코트노트를 연 뒤 "백업 불러오기"로 그 파일을 고르세요.'],
  ['홈 화면에 앱처럼 추가하려면?', '사파리 아래쪽 공유 버튼(네모에 화살표) → "홈 화면에 추가"를 누르세요. 아이콘을 눌러 열면 주소창 없이 앱처럼 열려요.'],
];

function Seg({ value, options, onChange }) {
  return (
    <div className="seg">
      {options.map(([v, label]) => (
        <button key={String(v)} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>{label}</button>
      ))}
    </div>
  );
}

export default function SettingsView() {
  const fav = useFavTeams();
  const prefs = usePrefs();
  const lastBackupAt = useSetting('lastBackupAt');
  const counts = useLiveQuery(async () => ({ entries: await db.entries.count(), photos: await db.photos.count() }), [], { entries: 0, photos: 0 });
  const [usage, setUsage] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    navigator.storage?.estimate?.().then((e) => setUsage(e.usage)).catch(() => {});
  }, [counts.entries, counts.photos]);

  const setFav = (leagueId, teamId) => setSetting('fav', { ...fav, [leagueId]: teamId || null });
  const setPref = (patch) => setSetting('prefs', { ...prefs, ...patch });
  const accentTeam = getTeam(fav.kbl) || getTeam(fav.uleague);
  const backupDays = daysSince(lastBackupAt);

  const onExport = async () => {
    setBusy(true);
    try {
      const r = await exportBackup();
      if (r) alert(`기록 ${r.count}개를 백업했어요.\n파일을 아이클라우드 드라이브 등 안전한 곳에 보관하세요.`);
    } catch (e) {
      alert('백업에 실패했어요: ' + e.message);
    }
    setBusy(false);
  };

  const onImport = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!confirm('백업 파일을 불러오면 지금 기기에 있는 기록이 모두 백업 내용으로 바뀌어요.\n계속할까요?')) return;
    setBusy(true);
    try {
      const r = await importBackup(file);
      alert(`기록 ${r.count}개, 사진 ${r.photos}장을 불러왔어요.`);
    } catch (err) {
      alert('불러오지 못했어요: ' + err.message);
    }
    setBusy(false);
  };

  return (
    <section className="page">
      <header className="page-head"><h1>설정</h1></header>

      {/* 응원팀 */}
      <div className="panel">
        <h3>응원팀</h3>
        <p className="muted small">경기를 고르면 응원팀이 자동으로 선택돼요.</p>
        {LEAGUES.map((l) => (
          <label key={l.id} className="setting-row">
            <span>{l.full}</span>
            <select value={fav[l.id] || ''} onChange={(e) => setFav(l.id, e.target.value)}>
              <option value="">없음</option>
              {teamsOf(l.id).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
        ))}
        <div className="setting-line">
          <span>
            응원팀 색으로 꾸미기
            <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>
              {accentTeam ? `버튼·강조색이 ${accentTeam.short} 색이 돼요` : '응원팀을 고르면 사용할 수 있어요'}
            </span>
          </span>
          <button
            className={'switch' + (prefs.teamAccent ? ' on' : '')}
            onClick={() => setPref({ teamAccent: !prefs.teamAccent })}
            aria-pressed={prefs.teamAccent}
            aria-label="응원팀 색으로 꾸미기"
          />
        </div>
      </div>

      {/* 화면 */}
      <div className="panel">
        <h3>화면</h3>
        <div className="setting-line">
          <span>테마</span>
          <Seg value={prefs.theme} options={[['system', '자동'], ['light', '라이트'], ['dark', '다크']]} onChange={(v) => setPref({ theme: v })} />
        </div>
        <div className="setting-line">
          <span>달력 시작 요일</span>
          <Seg value={prefs.weekStart} options={[[0, '일요일'], [1, '월요일']]} onChange={(v) => setPref({ weekStart: v })} />
        </div>
      </div>

      {/* 백업 */}
      <div className="panel">
        <h3>백업</h3>
        <p className="muted small">
          기록은 <b>이 기기에만</b> 저장돼요. 사파리 데이터 삭제나 기기 변경 시 사라질 수 있으니 가끔 백업해 주세요.
        </p>
        <p className={'small' + (backupDays == null || backupDays >= BACKUP_REMIND_DAYS ? ' warn' : '')} style={{ marginTop: 8 }}>
          {backupDays == null
            ? '아직 백업한 적이 없어요'
            : `마지막 백업: ${new Date(lastBackupAt).toLocaleDateString('ko-KR')} (${backupDays === 0 ? '오늘' : backupDays + '일 전'})`}
        </p>
        <p className="small muted">기록 {counts.entries}개 · 사진 {counts.photos}장{usage != null && ` · 약 ${(usage / 1024 / 1024).toFixed(1)}MB 사용`}</p>
        <div className="btn-row">
          <button className="btn primary" onClick={onExport} disabled={busy}>백업 내보내기</button>
          <label className={'btn ghost' + (busy ? ' disabled' : '')}>
            백업 불러오기
            <input type="file" accept=".json,application/json" onChange={onImport} hidden disabled={busy} />
          </label>
        </div>
      </div>

      {/* 경기 일정 */}
      <div className="panel">
        <h3>경기 일정</h3>
        {LEAGUES.map((l) => {
          const m = SCHEDULE_META[l.id];
          return (
            <div key={l.id} className="setting-line" style={{ alignItems: 'flex-start' }}>
              <span>
                {l.full}
                <span className="muted small" style={{ display: 'block', fontWeight: 400 }}>{m.seasons} · {m.source}</span>
              </span>
              <span className="small muted" style={{ textAlign: 'right', fontWeight: 400, flexShrink: 0 }}>
                {fmtUpdated(checkedAt(l.id))} 확인
                <br />
                {m.auto ? '30분마다 자동 확인' : '수동 업데이트'}
              </span>
            </div>
          );
        })}
        <ul className="plain muted">
          <li>KBL은 경기 시간대(13시~새벽 1시)에 공식 홈페이지를 30분마다 확인해 결과·일정 변경을 반영해요. 확인이 몇 분~몇십 분 늦어질 때도 있어요.</li>
          <li>대학농구는 시즌 중 수동으로 업데이트해요.</li>
          <li>D리그·EASL·올스타전은 포함하지 않아요 → "직접 입력"으로 기록하세요.</li>
        </ul>
      </div>

      {/* 도움말 */}
      <div className="panel help">
        <h3>도움말</h3>
        {HELP.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>

      {/* 앱 정보 */}
      <div className="panel">
        <h3>앱 정보</h3>
        <p className="small">코트노트 v{APP_VERSION} · 농구 직관·집관 일기</p>
        <ul className="plain muted">
          <li>경기 일정 출처: KBL 공식 홈페이지(kbl.or.kr), 한국대학스포츠협의회 KUSF(kusf.or.kr)</li>
          <li>코트노트는 KBL·KUSF 및 각 구단·대학과 관계없는 개인 기록 앱이에요.</li>
          <li>팀 로고·엠블럼·선수 사진은 사용하지 않으며, 팀 색상은 구분을 위한 표시예요.</li>
          <li>모든 기록과 사진은 서버로 전송되지 않고 이 기기에만 저장돼요.</li>
        </ul>
      </div>
    </section>
  );
}
