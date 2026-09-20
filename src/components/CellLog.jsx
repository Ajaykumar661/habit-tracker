import Calendar from './Calendar';
import BarLog from './BarLog';
import StreakHistory from './StreakHistory';

export default function CellLog({ routine, stats, today, shieldedDates, notes, onSetBreakReason, cursor, onPrevMonth, onNextMonth, onOpenDay, onTooltip, onMoveTooltip, onHideTooltip }) {
  return (
    <section className="cell-log" data-area="cell-log">
      <div className="cell-log-head">
        <h2 className="panel-title">CELL LOG</h2>
      </div>

      <Calendar
        routine={routine}
        today={today}
        shieldedDates={shieldedDates}
        notes={notes}
        cursor={cursor}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onOpenDay={onOpenDay}
        onTooltip={onTooltip}
        onMoveTooltip={onMoveTooltip}
        onHideTooltip={onHideTooltip}
      />

      <div className="bar-log">
        <h3 className="bar-log-title">RECENT TALLIES</h3>
        <BarLog stats={stats} />
        <StreakHistory routine={routine} today={today} onSetReason={onSetBreakReason} />
      </div>
    </section>
  );
}
