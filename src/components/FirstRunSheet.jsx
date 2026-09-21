import ModalOverlay from './ModalOverlay';
import PixelIcon from './PixelIcon';
import { STARTERS } from '../domain/starters';
import { useVoice } from '../hooks/useVoice';

// The very first screen: what the user wants to build. One tap sets up a
// routine the way the form would; "something else" opens the form itself.
export default function FirstRunSheet({ open, onPick, onOther, onSkip }) {
  const words = useVoice().firstRun;
  return (
    <ModalOverlay open={open} onClose={onSkip}>
      <div className="modal-title">{words.title}</div>
      <p className="first-run-lead">{words.lead}</p>
      <div className="first-run-grid">
        {STARTERS.map((s) => (
          <button key={s.id} type="button" className="first-run-pick" onClick={() => onPick(s)}>
            <PixelIcon icon={s.icon} />
            <span className="first-run-name">{s.name}</span>
            <span className="first-run-hint">{s.hint}</span>
          </button>
        ))}
      </div>
      <div className="first-run-actions">
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onOther}>{words.other}</button>
        <button type="button" className="choice-btn" onClick={onSkip}>{words.skip}</button>
      </div>
    </ModalOverlay>
  );
}
