import { motion } from 'framer-motion';
import { IconList, IconCalendar, IconTrophy } from './icons';
import { useVoice } from '../hooks/useVoice';

// Mobile-only persistent nav (see GameView.jsx's `collapsed` gate). Records
// and Achievements share one tab — they're one short scrollable panel
// already, so a second destination would just point at the same place.
export default function BottomTabBar({ active, onRoutines, onCalendar, onRecordAchievements }) {
  const v = useVoice();
  const tabs = [
    { key: 'routines', label: v.tabs.routines, Icon: IconList, onClick: onRoutines },
    { key: 'calendar', label: v.tabs.calendar, Icon: IconCalendar, onClick: onCalendar },
    { key: 'record', label: v.tabs.record, Icon: IconTrophy, onClick: onRecordAchievements },
  ];
  return (
    <nav className="hud-tabbar" aria-label="Sections">
      {tabs.map(({ key, label, Icon, onClick }) => (
        <motion.button
          key={key}
          type="button"
          className={'hud-tab' + (active === key ? ' active' : '')}
          onClick={onClick}
          whileTap={{ scale: 0.92 }}
        >
          <Icon />
          <span>{label}</span>
        </motion.button>
      ))}
    </nav>
  );
}
