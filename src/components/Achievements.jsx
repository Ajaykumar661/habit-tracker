import { useMemo } from 'react';
import Tray from './Tray';
import AchievementBadge from './AchievementBadge';
import { evaluateAchievements } from '../domain/achievements';
import { getAchievementDate } from '../domain/streaks';

// The plaques, in a retractable tray.
//
// The catalogue is scored across every habit, so the plaques belong to the
// keep rather than to whichever wall happens to be on screen. Only the
// streak plaques can be dated, and only against the active wall.
export default function Achievements({
  routine, habits, completions, today, defaultOpen = true,
}) {
  const scored = useMemo(
    () => evaluateAchievements(habits, completions, today),
    [habits, completions, today],
  );
  const unlockedCount = scored.filter((a) => a.unlocked).length;

  return (
    <Tray
      area="achievements"
      label="ACHIEVEMENTS"
      count={`${unlockedCount}/${scored.length}`}
      defaultOpen={defaultOpen}
    >
      <div className="achievements-grid">
        {scored.map((a) => (
          <AchievementBadge
            key={a.id}
            achievement={a}
            achievedDate={a.unlocked && a.days ? getAchievementDate(routine, a.days, today) : null}
          />
        ))}
      </div>
    </Tray>
  );
}
