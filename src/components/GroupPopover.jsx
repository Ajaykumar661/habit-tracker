import ModalOverlay from './ModalOverlay';
import { formatDateLabel } from '../lib/dates';

export default function GroupPopover({ dates, onClose }) {
  return (
    <ModalOverlay open={!!dates} onClose={onClose}>
      {dates && (
        <>
          <div className="modal-title">TALLY GROUP</div>
          <div className="modal-body">
            {dates.map((d, i) => (
              <div className="group-date-row" key={d}>
                <span>TALLY {i + 1}</span>
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
