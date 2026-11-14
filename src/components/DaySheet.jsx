import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db.js';
import { fmtDateFull } from '../lib/date.js';
import { sortEntries } from '../lib/entry.js';
import { EntryCard, LayerHead } from './ui.jsx';

export default function DaySheet({ date, nav }) {
  const entries = useLiveQuery(() => db.entries.where('date').equals(date).toArray(), [date], []);
  return (
    <>
      <LayerHead title={fmtDateFull(date)} onBack={nav.back} />
      <div className="layer-body">
        <div className="card-list">
          {sortEntries(entries).map((e) => (
            <EntryCard key={e.id} entry={e} onClick={() => nav.openEntry(e.id)} />
          ))}
        </div>
        <button className="btn primary block" onClick={() => nav.newEntry(date)}>＋ 이 날 기록 추가</button>
      </div>
    </>
  );
}
