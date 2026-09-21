import { useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { IconSpeaker } from './icons';
import { exportBackup, parseBackup, restoreBackup } from '../lib/backup';
import { MIN_CUTOFF_HOUR, MAX_CUTOFF_HOUR, formatDateLabel } from '../lib/dates';
import { backupStatus } from '../domain/upkeep';
import { Music } from '../lib/music';
import { SoundFX } from '../lib/sound';

const HOURS = Array.from(
  { length: MAX_CUTOFF_HOUR - MIN_CUTOFF_HOUR + 1 },
  (_, i) => MIN_CUTOFF_HOUR + i,
);

// Settings, and the only route in or out of the device for the tally history.
// Restoring replaces everything, so it asks first and says exactly what it
// found in the file before doing it.
export default function SettingsSheet({
  open, onClose, muted, onToggleMute, settings, onSetSetting, onOpenGuide,
  habits = [], archived = [], onRestore, onPurge,
}) {
  const fileRef = useRef(null);
  const [note, setNote] = useState(null);       // { kind: 'ok' | 'err', text }
  const [pending, setPending] = useState(null); // a parsed backup awaiting confirmation
  const [musicOn, setMusicOn] = useState(() => Music.isOn());
  const [musicVol, setMusicVol] = useState(() => Music.getVolume());
  const [sfxVol, setSfxVol] = useState(() => SoundFX.getVolume());
  const cutoff = settings?.dayCutoffHour ?? 0;
  const backup = backupStatus(habits, settings);

  function close() {
    setNote(null);
    setPending(null);
    onClose();
  }

  function handleExport() {
    try {
      const { routines, tallies } = exportBackup();
      // Recorded so the app can say how long it has been since the last copy.
      onSetSetting('lastExportAt', new Date().toISOString());
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

      {!muted && (
        <label className="settings-slider">
          <span>VOLUME</span>
          <input
            type="range" min="0" max="100" step="5"
            aria-label="Sound effects volume"
            value={Math.round(sfxVol * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setSfxVol(v);
              SoundFX.setVolume(v);
            }}
            onPointerUp={() => SoundFX.click()}
          />
        </label>
      )}

      <div className="settings-row">
        <span>MUSIC</span>
        <button
          type="button"
          className="pixel-btn pixel-btn-small"
          onClick={() => { const v = !musicOn; setMusicOn(v); Music.setOn(v); }}
        >
          <IconSpeaker muted={!musicOn} /> {musicOn ? 'ON' : 'OFF'}
        </button>
      </div>
      {musicOn && (
        <label className="settings-slider">
          <span>VOLUME</span>
          <input
            type="range" min="0" max="100" step="5"
            aria-label="Music volume"
            value={Math.round(musicVol * 100)}
            onChange={(e) => {
              const v = Number(e.target.value) / 100;
              setMusicVol(v);
              Music.setVolume(v);
            }}
          />
        </label>
      )}

      <div className="settings-row">
        <span>THE GUIDE</span>
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onOpenGuide}>
          READ
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-label">WHEN THE DAY TURNS</div>
        <p className="settings-help">
          If you often finish after midnight, move the turn later and the late
          hours will still count for the day before.
        </p>
        <div className="cutoff-row">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              className={`choice-btn${cutoff === h ? ' active' : ''}`}
              onClick={() => onSetSetting('dayCutoffHour', h)}
              aria-pressed={cutoff === h}
            >
              {h === 0 ? '12AM' : `${h}AM`}
            </button>
          ))}
        </div>
        <p className="settings-note-quiet">
          {cutoff === 0
            ? 'THE DAY TURNS AT MIDNIGHT.'
            : `A TALLY BEFORE ${cutoff}AM COUNTS FOR THE DAY BEFORE.`}
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-label">YOUR RECORD</div>
        <p className="settings-help">
          Everything stays on this device. Keep a copy somewhere safe so a lost
          phone doesn&rsquo;t take the streak with it.
        </p>
        <p className={`settings-note-quiet${backup.overdue ? ' warn' : ''}`}>
          {backup.label}
          {backup.tracked > 0 && ` · ${backup.tracked} DAYS OF RECORD`}
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

      {archived.length > 0 && (
        <div className="settings-section">
          <div className="settings-label">RETIRED QUESTS</div>
          <p className="settings-help">
            Their tallies are kept. Restore one to put it back on the board.
          </p>
          <ul className="archived-list">
            {archived.map((r) => (
              <li key={r.id} className="archived-row">
                <span className="archived-name">
                  {r.name}
                  <span className="archived-meta">
                    {r.completed.length} {r.completed.length === 1 ? 'TALLY' : 'TALLIES'}
                    {r.archivedAt && ` · ${formatDateLabel(r.archivedAt.slice(0, 10))}`}
                  </span>
                </span>
                <button type="button" className="pixel-btn pixel-btn-small" onClick={() => onRestore(r)}>
                  RESTORE
                </button>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-small danger"
                  onClick={() => onPurge(r)}
                  aria-label={`Delete ${r.name} forever`}
                >
                  DELETE
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {note && <p className={`settings-note${note.kind === 'err' ? ' err' : ''}`}>{note.text}</p>}

      <div className="modal-actions">
        <button type="button" className="pixel-btn pixel-btn-small" onClick={close}>CLOSE</button>
      </div>
    </ModalOverlay>
  );
}
