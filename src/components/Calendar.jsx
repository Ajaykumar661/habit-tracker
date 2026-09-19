import { motion } from 'framer-motion';
import { pad2, todayStr, formatDateLabel, MONTH_NAMES } from '../lib/dates';

export default function Calendar({ routine, cursor, onPrevMonth, onNextMonth, onToggleDay, onTooltip, onMoveTooltip, onHideTooltip }) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();
  const completedSet = new Set(routine.completed);

  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(day);

  return (
    <div className="calendar-box">
      <div className="calendar-nav">
        <button className="pixel-btn pixel-btn-tiny" type="button" onClick={onPrevMonth}>&lt;</button>
        <span className="calendar-label">{MONTH_NAMES[month]} {year}</span>
        <button className="pixel-btn pixel-btn-tiny" type="button" onClick={onNextMonth}>&gt;</button>
      </div>
      <div className="calendar-weekdays">
        <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
      </div>
      <div className="calendar-grid">
        {cells.map((day, idx) => {
          if (day === null) return <div key={`e${idx}`} className="cal-cell empty" />;

          const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
          const isFuture = dateStr > today;
          const isBeforeStart = dateStr < routine.startDate;
          const isDone = completedSet.has(dateStr);
          const isToday = dateStr === today;
          const isStartDay = dateStr === routine.startDate;
          const inRange = !isFuture && !isBeforeStart;

          let stateClass = '';
          if (isFuture) stateClass = 'future';
          else if (isDone) stateClass = 'done';
          else if (!isBeforeStart) stateClass = 'missed';

          return (
            <motion.div
              key={dateStr}
              className={[
                'cal-cell', stateClass,
                inRange ? 'in-range' : '',
                isToday ? 'today' : '',
                isStartDay ? 'start-day' : '',
              ].filter(Boolean).join(' ')}
              whileTap={inRange ? { scale: 1.3 } : undefined}
              whileHover={inRange ? { scale: 1.12 } : undefined}
              transition={{ type: 'spring', stiffness: 600, damping: 18 }}
              onClick={inRange ? (e) => onToggleDay(dateStr, e.currentTarget) : undefined}
              onMouseEnter={(e) => onTooltip(e, `${formatDateLabel(dateStr)}${isDone ? ' — TALLY MARKED' : ''}`)}
              onMouseMove={onMoveTooltip}
              onMouseLeave={onHideTooltip}
            >
              {day}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
