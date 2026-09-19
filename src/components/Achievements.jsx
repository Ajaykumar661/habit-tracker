import AchievementBadge from './AchievementBadge';
import { ACHIEVEMENTS } from '../lib/achievements';
import { getAchievementDate } from '../lib/streaks';

export default function Achievements({ routine, stats }) {
  return (
    <div data-area="achievements">
      <h2 className="panel-title">ACHIEVEMENTS</h2>
      <div className="achievements-grid">
        {ACHIEVEMENTS.map((a) => {
          const unlocked = stats.bestStreak >= a.days;
          const achievedDate = unlocked ? getAchievementDate(routine, a.days) : null;
          return (
            <AchievementBadge
              key={a.days}
              achievement={a}
              unlocked={unlocked}
              achievedDate={achievedDate}
            />
          );
        })}
      </div>
    </div>
  );
}
