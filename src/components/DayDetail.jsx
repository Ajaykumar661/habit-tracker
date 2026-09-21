import { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { getDayDetail, dayNumber } from '../domain/chronicle';
import { formatDateLabel } from '../lib/dates';
import { useVoice } from '../hooks/useVoice';

// One day of the chronicle, opened from the calendar.
//
// Reading a day must never change it, so nothing here writes on open. The
// only writes are deliberate: toggling a habit, or saving the day's note.

function QuestLine({ entry, state, onToggle, canToggle }) {
  const { habit, progress } = entry;
  return (
    <li className={`day-line ${state}`}>
      <button
        type="button"
        className="day-line-check"
        onClick={canToggle ? () => onToggle(habit.id) : undefined}
        disabled={!canToggle}
        aria-pressed={state === 'done'}
        aria-label={`${habit.name}: ${state === 'done' ? 'completed' : 'not completed'}`}
      >
        <span className="quest-check-fill" style={{ height: `${progress?.pct ?? 0}%` }} aria-hidden="true" />
      </button>
      <span className="day-line-name">{habit.name}</span>
      {progress && habit.type !== 'boolean' && (
        <span className="day-line-meta">{progress.text}</span>
      )}
    </li>
  );
}

export default function DayDetail({
  open, date, habits, completions, notes, today, onClose, onToggleHabit, onSaveNote,
}) {
  const v = useVoice();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (open && date) setDraft(notes?.[date] || '');
  }, [open, date, notes]);

  if (!open || !date) return null;

  const detail = getDayDetail(habits, completions, date, today);
  const n = dayNumber(habits, date);
  const noteChanged = draft !== (notes?.[date] || '');

  function close() {
    if (noteChanged) onSaveNote(date, draft);   // don't lose what was typed
    onClose();
  }

  return (
    <ModalOverlay open={open} onClose={close}>
      <div className="modal-title">{n ? `DAY ${n}` : v.day.chronicle}</div>
      <p className="day-date">{formatDateLabel(date)}</p>

      {detail.perfect && <p className="day-perfect">{v.day.perfect}</p>}

      <div className="day-body">
        {detail.completed.length > 0 && (
          <>
            <div className="day-heading done">COMPLETED</div>
            <ul className="day-list">
              {detail.completed.map((e) => (
                <QuestLine key={e.habit.id} entry={e} state="done" onToggle={onToggleHabit} canToggle={!detail.isFuture} />
              ))}
            </ul>
          </>
        )}

        {detail.missed.length > 0 && (
          <>
            <div className="day-heading missed">MISSED</div>
            <ul className="day-list">
              {detail.missed.map((e) => (
                <QuestLine key={e.habit.id} entry={e} state="missed" onToggle={onToggleHabit} canToggle />
              ))}
            </ul>
          </>
        )}

        {detail.pending.length > 0 && (
          <>
            <div className="day-heading">{v.day.pending}</div>
            <ul className="day-list">
              {detail.pending.map((e) => (
                <QuestLine key={e.habit.id} entry={e} state="pending" onToggle={onToggleHabit} canToggle={!detail.isFuture} />
              ))}
            </ul>
          </>
        )}

        {detail.notScheduled.length > 0 && (
          <>
            <div className="day-heading">NOT DUE</div>
            <ul className="day-list muted">
              {detail.notScheduled.map((e) => (
                <QuestLine key={e.habit.id} entry={e} state="not-due" onToggle={onToggleHabit} canToggle={!detail.isFuture} />
              ))}
            </ul>
          </>
        )}

        {!detail.completed.length && !detail.missed.length
          && !detail.pending.length && !detail.notScheduled.length && (
          <p className="day-empty">{v.day.nothing}</p>
        )}

        <div className="day-xp">XP EARNED <span>{detail.xp > 0 ? `+${detail.xp}` : '—'}</span></div>

        <label className="field-label" htmlFor="dayNote">{v.day.note}</label>
        <textarea
          id="dayNote"
          className="pixel-input day-note"
          rows={3}
          maxLength={2000}
          placeholder="What happened on this day?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
      </div>

      <div className="modal-actions">
        <button
          type="button"
          className="pixel-btn pixel-btn-small"
          onClick={() => { onSaveNote(date, draft); onClose(); }}
          disabled={!noteChanged}
        >
          SAVE
        </button>
        <button type="button" className="pixel-btn pixel-btn-small" onClick={close}>CLOSE</button>
      </div>
    </ModalOverlay>
  );
}
