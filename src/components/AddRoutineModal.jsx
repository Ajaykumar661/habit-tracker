import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { WEEKDAY_NAMES } from '../lib/dates';
import { DIFFICULTIES, HABIT_TYPES } from '../domain/schema';
import { isMeasuredType, UNIT_SUGGESTIONS, SECONDS_PER_MINUTE } from '../domain/completion';
import { editImpact, impactWarnings, nameTaken, FROZEN } from '../domain/editing';
import { useVoice } from '../hooks/useVoice';

// Creating a quest, and changing one afterwards. Kept as one short scroll of
// wooden controls rather than a multi-step wizard — the whole point is that
// adding a routine stays a few seconds' work.
//
// Editing reuses the same form, with two differences. The kind of quest and
// the start date are shown but locked, because past entries were recorded
// against them. And before saving, the form replays the record under the
// proposed settings and says plainly what would be lost — raising a goal
// from 8 to 10 can silently end a streak, and that should never be a
// surprise.

const DIFFICULTY_LABEL = { easy: 'EASY', normal: 'NORMAL', hard: 'HARD' };
const TYPE_LABEL = {
  boolean: 'DO IT',
  count: 'COUNT',
  duration: 'TIME',
  numeric: 'AMOUNT',
};
// Duration is entered in minutes and stored in seconds; everything else is
// stored exactly as typed.
const DEFAULT_TARGET = { count: 8, duration: 30, numeric: 30 };

export default function AddRoutineModal({
  open, onClose, onCreate, onSave, today, editing = null, habits = [],
}) {
  const v = useVoice();
  const isEdit = !!editing;
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(today);
  const [frequency, setFrequency] = useState('daily');
  const [weekdays, setWeekdays] = useState([1, 3, 5]);
  const [difficulty, setDifficulty] = useState('normal');
  const [type, setType] = useState('boolean');
  const [target, setTarget] = useState('8');
  const [unit, setUnit] = useState('');
  const nameRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name || '');
      setStartDate(editing.startDate || today);
      setFrequency(editing.schedule?.frequency || 'daily');
      setWeekdays(editing.schedule?.weekdays || []);
      setDifficulty(editing.difficulty || 'normal');
      setType(editing.type || 'boolean');
      // Duration is held in seconds and edited in minutes, matching create.
      setTarget(String(editing.type === 'duration'
        ? Math.round((editing.target || 0) / SECONDS_PER_MINUTE)
        : (editing.target ?? 8)));
      setUnit(editing.unit || '');
    } else {
      setName('');
      setStartDate(today);
      setFrequency('daily');
      setWeekdays([1, 3, 5]);
      setDifficulty('normal');
      setType('boolean');
      setTarget('8');
      setUnit('');
    }
    setTimeout(() => nameRef.current && nameRef.current.focus(), 50);
  }, [open, today, editing]);

  const scheduleIsEmpty = frequency === 'weekly' && weekdays.length === 0;
  const measured = isMeasuredType(type);
  const targetNum = Number(target);
  const targetInvalid = measured && !(targetNum > 0);
  const duplicate = nameTaken(habits, name, editing?.id);
  const canSave = !scheduleIsEmpty && !targetInvalid && !duplicate;

  // What the form is proposing, in the shape the domain expects.
  const proposed = {
    name: name.trim() || v.editor.fallbackName,
    difficulty,
    target: measured
      ? (type === 'duration' ? targetNum * SECONDS_PER_MINUTE : targetNum)
      : undefined,
    unit: measured && type !== 'duration' ? unit.trim().toUpperCase() : undefined,
    schedule: { frequency, weekdays: frequency === 'weekly' ? weekdays : [] },
  };

  // Only meaningful while editing: replay the record under the new settings.
  const warnings = (isEdit && !targetInvalid && !scheduleIsEmpty)
    ? impactWarnings(editImpact(editing, editing.records || {}, proposed, today))
    : [];

  function chooseType(next) {
    setType(next);
    if (isMeasuredType(next)) {
      setTarget(String(DEFAULT_TARGET[next] ?? 1));
      setUnit(next === 'duration' ? '' : (UNIT_SUGGESTIONS[next] || ''));
    }
  }

  function toggleDay(d) {
    setWeekdays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()));
  }

  function handleCreate() {
    if (!canSave) return;
    if (isEdit) {
      onSave(editing.id, proposed);
      return;
    }
    // Duration is typed in minutes but stored in seconds, so every engine
    // compares like with like.
    onCreate(proposed.name, startDate || today, { ...proposed, type });
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="modal-title">{isEdit ? v.editor.edit : v.editor.create}</div>
      <div className="modal-body">
        <label className="field-label" htmlFor="newRoutineName">{v.editor.name}</label>
        <input
          id="newRoutineName"
          ref={nameRef}
          className="pixel-input"
          type="text"
          maxLength={28}
          placeholder="E.G. READ 20 PAGES"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        />

        <span className="field-label">HOW IS IT MEASURED</span>
        <div className="choice-row" role="radiogroup" aria-label="How is it measured">
          {HABIT_TYPES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={type === value}
              className={`choice-btn${type === value ? ' active' : ''}`}
              onClick={() => chooseType(value)}
              disabled={isEdit}
            >
              {TYPE_LABEL[value]}
            </button>
          ))}
        </div>
        {isEdit && <p className="field-hint">{FROZEN.type}</p>}

        {measured && (
          <div className="target-row">
            <label className="target-field">
              <span className="field-label">GOAL{type === 'duration' ? ' (MINUTES)' : ''}</span>
              <input
                className="pixel-input"
                type="number"
                min="1"
                inputMode="numeric"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </label>
            {type !== 'duration' && (
              <label className="target-field">
                <span className="field-label">UNIT</span>
                <input
                  className="pixel-input"
                  type="text"
                  maxLength={12}
                  placeholder={UNIT_SUGGESTIONS[type] || ''}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </label>
            )}
          </div>
        )}
        {targetInvalid && <p className="field-hint warn">GOAL MUST BE AT LEAST 1</p>}
        {duplicate && <p className="field-hint warn">{v.editor.duplicate}</p>}

        <span className="field-label">HOW OFTEN</span>
        <div className="choice-row" role="radiogroup" aria-label="How often">
          {[['daily', 'EVERY DAY'], ['weekly', 'CHOSEN DAYS']].map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={frequency === value}
              className={`choice-btn${frequency === value ? ' active' : ''}`}
              onClick={() => setFrequency(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {frequency === 'weekly' && (
          <div className="weekday-row" role="group" aria-label="Days of the week">
            {WEEKDAY_NAMES.map((label, d) => (
              <button
                key={label}
                type="button"
                aria-pressed={weekdays.includes(d)}
                aria-label={label}
                className={`weekday-btn${weekdays.includes(d) ? ' active' : ''}`}
                onClick={() => toggleDay(d)}
              >
                {label[0]}
              </button>
            ))}
          </div>
        )}
        {scheduleIsEmpty && <p className="field-hint warn">CHOOSE AT LEAST ONE DAY</p>}

        <span className="field-label">DIFFICULTY</span>
        <div className="choice-row" role="radiogroup" aria-label="Difficulty">
          {DIFFICULTIES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={difficulty === value}
              className={`choice-btn${difficulty === value ? ' active' : ''}`}
              onClick={() => setDifficulty(value)}
            >
              {DIFFICULTY_LABEL[value]}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="newRoutineStart">START DATE</label>
        <input
          id="newRoutineStart"
          className="pixel-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          disabled={isEdit}
        />
        {isEdit && <p className="field-hint">{FROZEN.startDate}</p>}
      </div>
      {warnings.length > 0 && (
        <div className="edit-warning" role="alert">
          <div className="edit-warning-head">THIS CHANGES YOUR RECORD</div>
          {warnings.map((line) => <p key={line}>{line}</p>)}
        </div>
      )}

      <div className="modal-actions">
        <button className="pixel-btn pixel-btn-small" type="button" onClick={handleCreate} disabled={!canSave}>
          {isEdit ? 'SAVE' : 'CREATE'}
        </button>
        <button className="pixel-btn pixel-btn-small" type="button" onClick={onClose}>CANCEL</button>
      </div>
    </ModalOverlay>
  );
}
