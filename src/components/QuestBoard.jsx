import { motion, AnimatePresence } from 'framer-motion';
import Tray from './Tray';
import { questSummary } from '../domain/quests';
import { isMeasuredType } from '../domain/completion';
import { useVoice } from '../hooks/useVoice';

// The day's quests, on the same wooden board the routine list always used.
//
// Two separate actions per row, deliberately: the glyph logs progress, the
// name selects which habit the wall shows. Rolling them into one control
// would mean you couldn't look at a habit without also ticking it.

function QuestRow({ entry, active, onAdvance, onSelect, onEdit, onDelete, canDelete }) {
  const v = useVoice();
  const { habit, progress, due } = entry;
  const measured = isMeasuredType(habit.type);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -12, height: 0 }}
      className={[
        'quest-row',
        progress.complete && 'done',
        active && 'active',
        !due && 'not-due',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className="quest-check"
        onClick={() => onAdvance(habit.id)}
        aria-pressed={progress.complete}
        aria-label={progress.complete
          ? `${habit.name} complete. Undo`
          : `Log progress for ${habit.name}`}
        title={progress.complete ? 'Undo' : 'Log progress'}
      >
        {/* The box fills as the quest progresses — for a boolean that is
            simply empty or full. Drawn rather than lettered, because the
            pixel font has no tick or circle to borrow. */}
        <span className="quest-check-fill" style={{ height: `${progress.pct}%` }} aria-hidden="true" />
      </button>

      <button type="button" className="quest-name" onClick={() => onSelect(habit.id)}>
        <span className="quest-name-text">{habit.name}</span>
        <span className="quest-meta">
          {due ? (measured ? progress.text : (progress.complete ? v.quest.done : v.quest.notDone)) : entry.schedule}
        </span>
      </button>

      <button
        type="button"
        className="routine-edit-btn"
        title={v.quest.edit}
        aria-label={`Edit ${habit.name}`}
        onClick={(e) => { e.stopPropagation(); onEdit(habit); }}
      >
        <span className="edit-glyph" aria-hidden="true" />
      </button>

      {canDelete && (
        <button
          type="button"
          className="routine-delete-btn"
          title={v.quest.retire}
          aria-label={`Retire ${habit.name}`}
          onClick={(e) => { e.stopPropagation(); onDelete(habit); }}
        >
          ×
        </button>
      )}
    </motion.li>
  );
}

export default function QuestBoard({ board, activeId, onAdvance, onSelect, onEdit, onDelete }) {
  const v = useVoice();
  const canDelete = board.due.length + board.later.length > 1;
  const summary = questSummary(board, v.quest.summary);

  return (
    <Tray
      area="quests"
      className="quest-board"
      label={v.quest.board}
      count={`${board.doneCount}/${board.total}`}
    >
      <ul className="quest-list">
        <AnimatePresence initial={false}>
          {board.due.map((entry) => (
            <QuestRow
              key={entry.habit.id}
              entry={entry}
              active={entry.habit.id === activeId}
              onAdvance={onAdvance}
              onSelect={onSelect}
              onEdit={onEdit}
              onDelete={onDelete}
              canDelete={canDelete}
            />
          ))}
        </AnimatePresence>
      </ul>

      <div className={`quest-summary${board.allComplete ? ' complete' : ''}`} role="status">
        {summary}
      </div>

      {board.later.length > 0 && (
        <>
          <div className="quest-later-label">{v.quest.later}</div>
          <ul className="quest-list later">
            <AnimatePresence initial={false}>
              {board.later.map((entry) => (
                <QuestRow
                  key={entry.habit.id}
                  entry={entry}
                  active={entry.habit.id === activeId}
                  onAdvance={onAdvance}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  canDelete={canDelete}
                />
              ))}
            </AnimatePresence>
          </ul>
        </>
      )}
    </Tray>
  );
}
