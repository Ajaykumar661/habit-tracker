import { memo } from 'react';
import { themeFor } from '../data/themes';
import { earnedMilestones, nextMilestone } from '../domain/room';
import { useVoice } from '../hooks/useVoice';

// The room's objects as a row in the ledger: the ones earned in full, the
// rest as dark silhouettes, and what comes next. It is what makes the
// candle on the shelf read as a trophy rather than as furniture.
function RoomProgress({ theme, best, onShare }) {
  const voice = useVoice();
  const words = voice.room;
  const milestones = themeFor(theme).extras?.milestones || [];
  if (!milestones.length) return null;

  const earned = earnedMilestones(milestones, best);
  const next = nextMilestone(milestones, best);
  const held = new Set(earned.map((m) => m.id));

  return (
    <div className="room-progress" data-area="room">
      <div className="room-progress-head">
        <span className="room-progress-title">{words.title}</span>
        <span className="room-progress-count">{words.count(earned.length, milestones.length)}</span>
      </div>
      <ul className="room-progress-row">
        {milestones.map((m) => {
          const name = words.names[m.id] || m.id;
          const got = held.has(m.id);
          return (
            <li key={m.id} className={got ? 'got' : 'locked'}
              title={`${name} · ${m.day} DAYS`}
              aria-label={`${name}, ${got ? 'earned' : 'locked'}, ${m.day} days`}>
              <img src={m.src} alt="" draggable="false" />
              <span className="room-progress-day">{m.day}</span>
            </li>
          );
        })}
      </ul>
      <div className="room-progress-next">
        {next ? words.next(words.names[next.id] || next.id, next.day) : words.done}
      </div>
      {onShare && (
        <button type="button" className="pixel-btn pixel-btn-small room-share" onClick={onShare}>
          {voice.share.button}
        </button>
      )}
    </div>
  );
}

export default memo(RoomProgress);
