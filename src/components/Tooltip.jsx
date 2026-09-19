export default function Tooltip({ tooltip }) {
  if (!tooltip) return null;
  return (
    <div className="tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
      {tooltip.text}
    </div>
  );
}
