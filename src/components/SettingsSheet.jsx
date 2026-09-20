import { useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { IconSpeaker } from './icons';
import { exportBackup, parseBackup, restoreBackup } from '../lib/backup';

// Settings, and the only route in or out of the device for the tally history.
// Restoring replaces everything, so it asks first and says exactly what it
// found in the file before doing it.
export default function SettingsSheet({ open, onClose, muted, onToggleMute }) {
  const fileRef = useRef(null);
  const [note, setNote] = useState(null);       // { kind: 'ok' | 'err', text }
  const [pending, setPending] = useState(null); // a parsed backup awaiting confirmation

  function close() {
    setNote(null);
    setPending(null);
    onClose();
  }

  function handleExport() {
    try {
      const { routines, tallies } = exportBackup();
      setNote({ kind: 'ok', text: `SAVED ${tallies} TALLIES FROM ${routines} ROUTINE${routines === 1 ? '' : 'S'}` });
    } catch (e) {
      setNote({ kind: 'err', text: e.message.toUpperCase() });
    }
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';           // so the same file can be picked twice
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      setNote(null);
      setPending(parsed);
    } catch (err) {
      setPending(null);
      setNote({ kind: 'err', text: err.message.toUpperCase() });
    }
  }

  function confirmRestore() {
    restoreBackup(pending.state);
    // A reload is the honest way to adopt a wholesale state replacement —
    // every hook re-reads from storage on mount.
    window.location.reload();
  }

  return (
    <ModalOverlay open={open} onClose={close}>
      <div className="modal-title">SETTINGS</div>

      <div className="settings-row">
        <span>SOUND EFFECTS</span>
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onToggleMute}>
          <IconSpeaker muted={muted} /> {muted ? 'OFF' : 'ON'}
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-label">YOUR RECORD</div>
        <p className="settings-help">
          Everything stays on this device. Keep a copy somewhere safe so a lost
          phone doesn&rsquo;t take the streak with it.
        </p>
        {pending ? (
          <>
            <p className="settings-help settings-warn">
              This replaces everything here with {pending.tallies} tallies from{' '}
              {pending.routines} routine{pending.routines === 1 ? '' : 's'}.
            </p>
            <div className="settings-actions">
              <button type="button" className="pixel-btn pixel-btn-small" onClick={confirmRestore}>REPLACE</button>
              <button type="button" className="pixel-btn pixel-btn-small" onClick={() => setPending(null)}>CANCEL</button>
            </div>
          </>
        ) : (
          <div className="settings-actions">
            <button type="button" className="pixel-btn pixel-btn-small" onClick={handleExport}>EXPORT</button>
            <button type="button" className="pixel-btn pixel-btn-small" onClick={() => fileRef.current?.click()}>IMPORT</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="application/json,.json" onChange={handleFile} hidden />
      </div>

      {note && <p className={`settings-note${note.kind === 'err' ? ' err' : ''}`}>{note.text}</p>}

      <div className="modal-actions">
        <button type="button" className="pixel-btn pixel-btn-small" onClick={close}>CLOSE</button>
      </div>
    </ModalOverlay>
  );
}
