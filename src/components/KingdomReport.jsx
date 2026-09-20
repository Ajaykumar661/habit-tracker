import { useMemo } from 'react';
import Tray from './Tray';
import {
  weeklyReport, reportVerdict, findPatterns, weekdayBreakdown, weeksTracked,
} from '../domain/analytics';
import { formatDateLabel } from '../lib/dates';

// The herald's weekly account of the keep.
//
// Everything shown here is drawn from the record and nothing is asserted
// without the evidence behind it: a weekday bar with too little history is
// drawn hollow rather than confidently reported as a weak day, and the
// observations below only appear once the domain layer judges them earned.
//
// The tone is deliberate. The report never tells you that you failed.

function Bar({ row, best }) {
  const height = row.due ? Math.max(4, Math.round(row.rate * 100)) : 0;
  return (
    <div className={`week-bar${row.enough ? '' : ' thin'}${row.enough && row.rate >= best && best > 0 ? ' best' : ''}`}>
      <div className="week-bar-track">
        <div className="week-bar-fill" style={{ height: `${height}%` }} />
      </div>
      <span className="week-bar-label">{row.name}</span>
    </div>
  );
}

export default function KingdomReport({ habits, completions, today, defaultOpen = false }) {
  const { report, patterns, weekdays, weeks } = useMemo(() => ({
    report: weeklyReport(habits, completions, today),
    patterns: findPatterns(habits, completions, today),
    weekdays: weekdayBreakdown(habits, completions, today),
    weeks: weeksTracked(habits, today),
  }), [habits, completions, today]);

  const bestRate = Math.max(0, ...weekdays.filter((d) => d.enough).map((d) => d.rate));
  const pct = Math.round(report.rate * 100);

  return (
    <Tray
      area="report"
      label="KINGDOM REPORT"
      count={report.enough ? `${pct}%` : '—'}
      defaultOpen={defaultOpen}
    >
      <div className="report-body">
        <p className="report-verdict">{reportVerdict(report)}</p>
        <p className="report-range">
          {formatDateLabel(report.from)} &rarr; {formatDateLabel(report.to)}
        </p>

        <dl className="stats-list report-figures">
          <div className="stat-row">
            <dt>KEPT</dt>
            <dd>{report.done} / {report.due}</dd>
          </div>
          <div className="stat-row">
            <dt>PERFECT DAYS</dt>
            <dd>{report.perfectDays}</dd>
          </div>
          <div className="stat-row">
            <dt>XP EARNED</dt>
            <dd>{report.xp > 0 ? `+${report.xp}` : '—'}</dd>
          </div>
          {report.delta !== null && (
            <div className="stat-row">
              <dt>AGAINST LAST WEEK</dt>
              <dd className={report.delta >= 0 ? 'delta-up' : 'delta-down'}>
                {report.delta >= 0 ? '+' : ''}{Math.round(report.delta * 100)}%
              </dd>
            </div>
          )}
        </dl>

        <div className="week-chart" role="img" aria-label="Completion by weekday">
          {weekdays.map((row) => (
            <Bar key={row.weekday} row={row} best={bestRate} />
          ))}
        </div>

        {patterns.length > 0 ? (
          <ul className="report-patterns">
            {patterns.map((p) => (
              <li key={p.id} className={`pattern ${p.tone}`}>
                <span className="pattern-text">{p.text}</span>
                <span className="pattern-sample">FROM {p.sample} DAYS</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="report-waiting">
            {weeks < 1
              ? 'THE HERALD NEEDS A FULL WEEK BEFORE SPEAKING.'
              : 'NO CLEAR PATTERN YET. KEEP THE RECORD AND IT WILL SHOW.'}
          </p>
        )}
      </div>
    </Tray>
  );
}
