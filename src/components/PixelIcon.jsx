import { ICON_BITMAPS } from '../lib/achievements';

export default function PixelIcon({ icon }) {
  const bitmap = ICON_BITMAPS[icon] || ICON_BITMAPS.star;
  return (
    <div className="pixel-icon">
      {bitmap.flatMap((row, ri) =>
        [...row].map((c, ci) => (
          <span key={`${ri}-${ci}`} className={c === '1' ? 'on' : ''} />
        )),
      )}
    </div>
  );
}
