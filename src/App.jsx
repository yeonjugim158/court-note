import { useEffect, useRef, useState } from 'react';
import { useFavTeams, usePrefs } from './lib/hooks.js';
import { getTeam } from './data/teams.js';
import { fillFinishedScores } from './lib/sync.js';
import CalendarView from './components/CalendarView.jsx';
import FeedView from './components/FeedView.jsx';
import StatsView from './components/StatsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import DaySheet from './components/DaySheet.jsx';
import EntryForm from './components/EntryForm.jsx';
import EntryDetail from './components/EntryDetail.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

const TABS = [
  { id: 'calendar', label: '달력', icon: '🗓️' },
  { id: 'feed', label: '기록', icon: '📒' },
  { id: 'stats', label: '통계', icon: '📊' },
  { id: 'settings', label: '설정', icon: '⚙️' },
];

export default function App() {
  const [tab, setTab] = useState('calendar');
  const [stack, setStack] = useState([]);
  const keyRef = useRef(0);

  const prefs = usePrefs();
  const fav = useFavTeams();

  // 경기 중에 남긴 기록에 끝난 경기의 최종 스코어 채우기
  useEffect(() => {
    fillFinishedScores().catch(() => {});
  }, []);

  // 테마 · 응원팀 강조색 적용
  useEffect(() => {
    const root = document.documentElement;
    if (prefs.theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = prefs.theme;
    const team = getTeam(fav.kbl) || getTeam(fav.uleague);
    if (prefs.teamAccent && team) {
      root.dataset.accent = 'team';
      root.style.setProperty('--team-accent', team.color);
    } else {
      delete root.dataset.accent;
      root.style.removeProperty('--team-accent');
    }
  }, [prefs.theme, prefs.teamAccent, fav.kbl, fav.uleague]);

  const push = (v) => setStack((s) => [...s, { ...v, key: ++keyRef.current }]);
  const back = () => setStack((s) => s.slice(0, -1));

  const nav = {
    openDay: (date) => push({ type: 'day', date }),
    newEntry: (date) => push({ type: 'form', date }),
    editEntry: (entryId) => push({ type: 'form', entryId }),
    openEntry: (entryId) => push({ type: 'detail', entryId }),
    back,
  };

  return (
    <div className="app">
      <main className="main">
        <ErrorBoundary key={tab}>
          {tab === 'calendar' && <CalendarView nav={nav} weekStart={prefs.weekStart} goSettings={() => setTab('settings')} />}
          {tab === 'feed' && <FeedView nav={nav} />}
          {tab === 'stats' && <StatsView />}
          {tab === 'settings' && <SettingsView />}
        </ErrorBoundary>
      </main>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="tab-icon" aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>

      {stack.map((v) => (
        <div className="layer" key={v.key}>
          <ErrorBoundary>
            {v.type === 'day' && <DaySheet date={v.date} nav={nav} />}
            {v.type === 'form' && <EntryForm date={v.date} entryId={v.entryId} onClose={back} />}
            {v.type === 'detail' && <EntryDetail entryId={v.entryId} nav={nav} />}
          </ErrorBoundary>
        </div>
      ))}
    </div>
  );
}
