import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import TallyGroup from './TallyGroup';
import { chunk5 } from '../domain/streaks';
import { formatDateLabel } from '../lib/dates';

const MIN_FADE = 0.55;
const FADE_STEP = 0.09;

export default function TallyWall({ stats, jailControls, freshDate, onOpenGroup, onTooltip, onMoveTooltip, onHideTooltip }) {
  const activeDates = stats.currentSegment ? stats.currentSegment.dates : [];
  const groups = chunk5(activeDates);
  const prevSegs = stats.prevSegments.slice(-4);

  // Open on the newest marks: once the wall overflows, the latest tallies
  // are what matter, not the oldest ones at the top.
  const wrapRef = useRef(null);
  useEffect(() => {
    const el = wrapRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeDates.length]);

  const groupLabel = (dates) => `${dates.length} TALLIES: ${formatDateLabel(dates[0])} – ${formatDateLabel(dates[dates.length - 1])}`;

  return (
    <motion.div className="jail-frame" animate={jailControls}>
      {/* Shared by every tally group (strengths from tally-wall-medieval.svg):
          subtly worn edges on the marks, rougher on the slash. */}
      <svg className="tally-defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          <filter id="tally-roughen" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.035 0.12" numOctaves="2" seed="17" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id="tally-slash-rough" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence type="fractalNoise" baseFrequency="0.07 0.22" numOctaves="2" seed="31" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.4" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <div className="tally-stage-wrap" ref={wrapRef}>
        <div className="tally-stage">
          {groups.length === 0 ? (
            <motion.div
              className="wall-empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="wall-empty-title">YOUR WALL IS EMPTY</div>
              <div className="wall-empty-sub">FIRST TALLY AWAITS</div>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {groups.map((group, i) => {
                const fromNewest = groups.length - 1 - i;
                const fade = Math.max(MIN_FADE, 1 - fromNewest * FADE_STEP);
                return (
                  <TallyGroup
                    key={group[0]}
                    dates={group}
                    fade={fade}
                    fresh={freshDate ? group.includes(freshDate) : false}
                    onOpen={onOpenGroup}
                    onEnter={(e, dates) => onTooltip(e, groupLabel(dates))}
                    onMove={onMoveTooltip}
                    onLeave={onHideTooltip}
                  />
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {prevSegs.length > 0 && (
          <div className="prev-sentences">
            {prevSegs.map((seg) => (
              <div className="prev-sentence-row" key={seg.dates[0]}>
                <span className="prev-sentence-label">
                  BROKEN — {seg.dates.length} DAY{seg.dates.length === 1 ? '' : 'S'}
                </span>
                <div className="prev-sentence-tallies">
                  {chunk5(seg.dates).map((group) => (
                    <TallyGroup
                      key={group[0]}
                      dates={group}
                      fade={0.85}
                      onOpen={onOpenGroup}
                      onEnter={(e, dates) => onTooltip(e, groupLabel(dates))}
                      onMove={onMoveTooltip}
                      onLeave={onHideTooltip}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
