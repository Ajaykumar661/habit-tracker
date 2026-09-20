// Small hand-drawn glyph set for the mobile icon-only controls (see
// TopBar.jsx, BottomTabBar.jsx). Square joins/caps, no curve smoothing —
// reads as "carved/cut" rather than a generic modern icon-font, matching
// the rest of the pixel-HUD. currentColor throughout so a button's normal
// text color styles the icon with it, hover/active states included free.
const BASE = { viewBox: '0 0 24 24', width: '1em', height: '1em', 'aria-hidden': 'true', focusable: 'false' };
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'square', strokeLinejoin: 'miter' };

export function IconMenu(props) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

export function IconSpeaker({ muted, ...props }) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M4 9h4l6-5v16l-6-5H4z" />
      {muted ? (
        <path {...STROKE} d="M16 9l5 6M21 9l-5 6" />
      ) : (
        <path {...STROKE} d="M17 8c1.6 1.2 1.6 6.8 0 8M20 5c3.2 2.6 3.2 10.4 0 14" />
      )}
    </svg>
  );
}

export function IconPlus(props) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M12 4v16M4 12h16" />
    </svg>
  );
}

export function IconList(props) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M8 6h12M8 12h12M8 18h12M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" />
    </svg>
  );
}

export function IconCalendar(props) {
  return (
    <svg {...BASE} {...props}>
      <rect x="3" y="5" width="18" height="16" {...STROKE} />
      <path {...STROKE} d="M3 10h18M7 2v6M17 2v6" />
    </svg>
  );
}

export function IconBarChart(props) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M4 21V11M12 21V4M20 21v-7" />
      <path d="M4 21h16" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconTrophy(props) {
  return (
    <svg {...BASE} {...props}>
      <path {...STROKE} d="M7 4h10v6a5 5 0 0 1-10 0V4z" />
      <path {...STROKE} d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
      <path {...STROKE} d="M12 15v3M8 21h8M8.5 21c0-2 1-3 3.5-3s3.5 1 3.5 3" />
    </svg>
  );
}

// Short, chunky teeth — long thin spokes read as a sun at HUD size.
export function IconGear(props) {
  return (
    <svg {...BASE} {...props}>
      <circle cx="12" cy="12" r="6.6" {...STROKE} />
      <circle cx="12" cy="12" r="2.4" {...STROKE} />
      <path {...STROKE} strokeWidth="2.6"
        d="M12 3.2v2.2M12 18.6v2.2M3.2 12h2.2M18.6 12h2.2M5.8 5.8l1.6 1.6M16.6 16.6l1.6 1.6M18.2 5.8l-1.6 1.6M7.4 16.6l-1.6 1.6" />
    </svg>
  );
}
