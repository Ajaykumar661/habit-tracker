import Calendar from './Calendar';
import BarLog from './BarLog';

export default function CellLog({ routine, stats, cursor, onPrevMonth, onNextMonth, onToggleDay, onTooltip, onMoveTooltip, onHideTooltip }) {
  return (
    <section className="cell-log" data-area="cell-log">
      <div className="cell-log-head">
        <h2 className="panel-title">CELL LOG</h2>
      </div>

      <Calendar
        routine={routine}
        cursor={cursor}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onToggleDay={onToggleDay}
        onTooltip={onTooltip}
        onMoveTooltip={onMoveTooltip}
        onHideTooltip={onHideTooltip}
      />

      <div className="bar-log">
        <h3 className="bar-log-title">RECENT TALLIES</h3>
        <BarLog stats={stats} />
      </div>
    </section>
  );
}
