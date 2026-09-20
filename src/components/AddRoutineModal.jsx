import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { WEEKDAY_NAMES } from '../lib/dates';
import { DIFFICULTIES, HABIT_TYPES } from '../domain/schema';
import { isMeasuredType, UNIT_SUGGESTIONS, SECONDS_PER_MINUTE } from '../domain/completion';

// Creating a quest. Kept as one short scroll of wooden controls rather than a
// multi-step wizard — the whole point is that adding a routine stays a few
// seconds' work.

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

export default function AddRoutineModal({ open, onClose, onCreate, today }) {
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
    if (open) {
      setName('');
      setStartDate(today);
      setFrequency('daily');
      setWeekdays([1, 3, 5]);
      setDifficulty('normal');
      setType('boolean');
      setTarget('8');
      setUnit('');
      setTimeout(() => nameRef.current && nameRef.current.focus(), 50);
    }
  }, [open, today]);

  const scheduleIsEmpty = frequency === 'weekly' && weekdays.length === 0;
  const measured = isMeasuredType(type);
  const targetNum = Number(target);
  const targetInvalid = measured && !(targetNum > 0);
  const canSave = !scheduleIsEmpty && !targetInvalid;

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
    onCreate(name.trim() || 'MY ROUTINE', startDate || today, {
      type,
      difficulty,
      // Duration is typed in minutes but stored in seconds, so every engine
      // compares like with like.
      target: measured ? (type === 'duration' ? targetNum * SECONDS_PER_MINUTE : targetNum) : undefined,
      unit: measured && type !== 'duration' ? unit.trim().toUpperCase() : undefined,
      schedule: { frequency, weekdays: frequency === 'weekly' ? weekdays : [] },
    });
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="modal-title">NEW QUEST</div>
      <div className="modal-body">
        <label className="field-label" htmlFor="newRoutineName">QUEST NAME</label>
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
            >
              {TYPE_LABEL[value]}
            </button>
          ))}
        </div>

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
        />
      </div>
      <div className="modal-actions">
        <button className="pixel-btn pixel-btn-small" type="button" onClick={handleCreate} disabled={!canSave}>
          CREATE
        </button>
        <button className="pixel-btn pixel-btn-small" type="button" onClick={onClose}>CANCEL</button>
      </div>
    </ModalOverlay>
  );
}
