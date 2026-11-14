import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { sortEntries } from '../lib/entry.js';
import { EntryCard, Empty } from './ui.jsx';

const FILTERS = [
  { id: 'all', label: '전체', fn: () => true },
  { id: 'live', label: '🏟️ 직관', fn: (e) => e.mode === 'live' },
  { id: 'home', label: '📺 집관', fn: (e) => e.mode === 'home' },
  { id: 'kbl', label: 'KBL', fn: (e) => e.game.leagueId === 'kbl' },
  { id: 'uleague', label: '대학', fn: (e) => e.game.leagueId === 'uleague' },
];

export default function FeedView({ nav }) {
  const [filter, setFilter] = useState('all');
  const all = useLiveQuery(() => db.entries.toArray(), [], []);
  const list = sortEntries(all.filter(FILTERS.find((f) => f.id === filter).fn)).reverse();

  const groups = [];
  for (const e of list) {
    const ym = e.date.slice(0, 7);
    if (!groups.length || groups[groups.length - 1].ym !== ym) groups.push({ ym, items: [] });
    groups[groups.length - 1].items.push(e);
  }

  return (
    <section className="page">
      <header className="page-head"><h1>기록</h1><span className="muted">{list.length}개</span></header>
      <div className="chips scroll">
        {FILTERS.map((f) => (
          <button key={f.id} className={filter === f.id ? 'on' : ''} onClick={() => setFilter(f.id)}>{f.label}</button>
        ))}
      </div>
      {list.length === 0 && <Empty title="아직 기록이 없어요">달력에서 날짜를 눌러 첫 경기를 기록해 보세요.</Empty>}
      {groups.map((gr) => (
        <div key={gr.ym}>
          <h3 className="group-title">{Number(gr.ym.slice(0, 4))}년 {Number(gr.ym.slice(5))}월</h3>
          <div className="card-list">
            {gr.items.map((e) => <EntryCard key={e.id} entry={e} showDate onClick={() => nav.openEntry(e.id)} />)}
          </div>
        </div>
      ))}
    </section>
  );
}
