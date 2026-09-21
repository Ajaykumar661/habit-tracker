import ModalOverlay from './ModalOverlay';
import { formatDateLabel } from '../lib/dates';
import { useVoice } from '../hooks/useVoice';

export default function GroupPopover({ dates, onClose }) {
  const v = useVoice();
  return (
    <ModalOverlay open={!!dates} onClose={onClose}>
      {dates && (
        <>
          <div className="modal-title">{v.wall.one} GROUP</div>
          <div className="modal-body">
            {dates.map((d, i) => (
              <div className="group-date-row" key={d}>
                <span>{v.wall.one} {i + 1}</span>
                <span>{formatDateLabel(d)}</span>
              </div>
            ))}
          </div>
          <button className="pixel-btn pixel-btn-small" type="button" onClick={onClose}>CLOSE</button>
        </>
      )}
    </ModalOverlay>
  );
}
