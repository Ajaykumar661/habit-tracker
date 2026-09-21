import { useMemo } from 'react';
import ModalOverlay from './ModalOverlay';
import { formatDateLabel } from '../lib/dates';
import { RECOVERY_RULES } from '../domain/recovery';
import { useVoice } from '../hooks/useVoice';

// Shown once when a run of real length has lapsed. A broken streak otherwise
// just silently becomes zero, which reads as the app losing the record rather
// than the record ending — this says plainly what happened, keeps the best
// streak in view so the work isn't erased, and points forward.
export default function StreakLostModal({ broken, bestStreak, onDismiss }) {
  const v = useVoice();
  // Fixed for the lifetime of this particular loss, so it doesn't reshuffle
  // underneath the reader on a re-render.
  const pool = v.quotes.pools.STREAK_LOST;
  const line = useMemo(
    () => pool[Math.floor(Math.random() * pool.length)],
    [broken?.endedOn, pool],
  );
  if (!broken) return null;

  return (
    <ModalOverlay open onClose={onDismiss}>
      <div className="modal-title streak-lost-title">{v.lost.title}</div>

      <div className="streak-lost-count">
        <span className="streak-lost-days">{broken.days}</span>
        <span className="streak-lost-unit">{broken.days === 1 ? 'DAY' : 'DAYS'}</span>
      </div>
      <p className="streak-lost-when">{v.lost.ended} {formatDateLabel(broken.endedOn)}</p>

      <p className="streak-lost-line">&ldquo;{line}&rdquo;</p>

      {bestStreak > 0 && (
        <p className="streak-lost-best">
          {v.lost.best(bestStreak)}
        </p>
      )}

      {/* Somewhere to go next, rather than only something to mourn. */}
      <p className="streak-lost-rally">
        {v.lost.cta(RECOVERY_RULES.goalDays)}
      </p>

      <div className="modal-actions">
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onDismiss}>
          {v.lost.button}
        </button>
      </div>
    </ModalOverlay>
  );
}
