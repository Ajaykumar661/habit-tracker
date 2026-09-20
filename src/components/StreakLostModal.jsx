import { useMemo } from 'react';
import ModalOverlay from './ModalOverlay';
import { QUOTES } from '../data/quotes';
import { formatDateLabel } from '../lib/dates';
import { RECOVERY_RULES } from '../domain/recovery';

// Shown once when a run of real length has lapsed. A broken streak otherwise
// just silently becomes zero, which reads as the app losing the record rather
// than the record ending — this says plainly what happened, keeps the best
// streak in view so the work isn't erased, and points forward.
export default function StreakLostModal({ broken, bestStreak, onDismiss }) {
  // Fixed for the lifetime of this particular loss, so it doesn't reshuffle
  // underneath the reader on a re-render.
  const line = useMemo(
    () => QUOTES.STREAK_LOST[Math.floor(Math.random() * QUOTES.STREAK_LOST.length)],
    [broken?.endedOn],
  );
  if (!broken) return null;

  return (
    <ModalOverlay open onClose={onDismiss}>
      <div className="modal-title streak-lost-title">THE STREAK IS BROKEN</div>

      <div className="streak-lost-count">
        <span className="streak-lost-days">{broken.days}</span>
        <span className="streak-lost-unit">{broken.days === 1 ? 'DAY' : 'DAYS'}</span>
      </div>
      <p className="streak-lost-when">ENDED {formatDateLabel(broken.endedOn)}</p>

      <p className="streak-lost-line">&ldquo;{line}&rdquo;</p>

      {bestStreak > 0 && (
        <p className="streak-lost-best">
          YOUR LONGEST STANDS AT {bestStreak} {bestStreak === 1 ? 'DAY' : 'DAYS'}
        </p>
      )}

      {/* Somewhere to go next, rather than only something to mourn. */}
      <p className="streak-lost-rally">
        RETURN FOR {RECOVERY_RULES.goalDays} DAYS TO WIN THE RALLY
      </p>

      <div className="modal-actions">
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onDismiss}>
          BEGIN ANEW
        </button>
      </div>
    </ModalOverlay>
  );
}
