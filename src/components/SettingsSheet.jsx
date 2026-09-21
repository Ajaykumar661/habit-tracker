import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { IconSpeaker } from './icons';
import { exportBackup, parseBackup, restoreBackup } from '../lib/backup';
import { MIN_CUTOFF_HOUR, MAX_CUTOFF_HOUR, formatDateLabel } from '../lib/dates';
import { backupStatus } from '../domain/upkeep';
import { THEMES } from '../data/themes';
import { Music } from '../lib/music';
import { SoundFX } from '../lib/sound';
import { useVoice } from '../hooks/useVoice';
import { REMINDER_TIMES, formatReminderTime, reminderTimeOf } from '../domain/reminders';
import { remindersAvailable, requestReminderPermission } from '../lib/reminders';
import { canPinWidget, pinWidget } from '../lib/widget';

const HOURS = Array.from(
  { length: MAX_CUTOFF_HOUR - MIN_CUTOFF_HOUR + 1 },
  (_, i) => MIN_CUTOFF_HOUR + i,
);

/**
 * A volume slider whose knob carries what it controls -- a speaker for the
 * effects, a note for the music -- so the two read at a glance instead of
 * as two identical browser bars. The fill is painted from --fill.
 */
function VolumeSlider({ kind, label, value, onChange, onRelease }) {
  const pct = Math.round(value * 100);
  return (
    <label className={`vol-slider vol-${kind}`}>
      <input
        type="range" min="0" max="100" step="5"
        aria-label={label}
        value={pct}
        style={{ '--fill': `${pct}%` }}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onRelease}
      />
      <span className="vol-readout" aria-hidden="true">{pct}%</span>
    </label>
  );
}

// Settings, and the only route in or out of the device for the tally history.
// Restoring replaces everything, so it asks first and says exactly what it
// found in the file before doing it.
export default function SettingsSheet({
  open, onClose, muted, onToggleMute, settings, onSetSetting, onOpenGuide,
  habits = [], archived = [], onRestore, onPurge,
}) {
  const v = useVoice();
  const fileRef = useRef(null);
  const [note, setNote] = useState(null);       // { kind: 'ok' | 'err', text }
  const [pending, setPending] = useState(null); // a parsed backup awaiting confirmation
  const [musicOn, setMusicOn] = useState(() => Music.isOn());
  const [musicVol, setMusicVol] = useState(() => Music.getVolume());
  const [sfxVol, setSfxVol] = useState(() => SoundFX.getVolume());
  const [remindNote, setRemindNote] = useState(null);
  const [canPin, setCanPin] = useState(false);
  useEffect(() => { if (open) canPinWidget().then(setCanPin); }, [open]);
  const cutoff = settings?.dayCutoffHour ?? 0;
  const backup = backupStatus(habits, settings);

  function close() {
    setNote(null);
    setPending(null);
    onClose();
  }

  async function handleExport() {
    try {
      const { routines, tallies, cancelled } = await exportBackup();
      if (cancelled) {
        // Nothing was saved, so neither the note nor the backup date may say so.
        setNote({ kind: 'err', text: 'EXPORT CANCELLED \u2014 NOTHING WAS SAVED' });
        return;
      }
      // Recorded so the app can say how long it has been since the last copy.
      onSetSetting('lastExportAt', new Date().toISOString());
      setNote({ kind: 'ok', text: v.settings.saved(tallies, routines) });
    } catch (e) {
      setNote({ kind: 'err', text: e.message.toUpperCase() });
    }
  }

  async function toggleReminder() {
    if (settings?.reminderOn) { onSetSetting('reminderOn', false); return; }
    // Permission is asked here, on the user's own tap -- never on launch.
    // A failed request counts as a no, never as an unhandled error.
    if (await requestReminderPermission().catch(() => false)) {
      setRemindNote(null);
      onSetSetting('reminderOn', true);
    } else {
      setRemindNote(v.remind.denied);
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
        <VolumeSlider
          kind="sfx"
          label="Sound effects volume"
          value={sfxVol}
          onChange={(v) => { setSfxVol(v); SoundFX.setVolume(v); }}
          onRelease={() => SoundFX.click()}
        />
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
        <VolumeSlider
          kind="music"
          label="Music volume"
          value={musicVol}
          onChange={(v) => { setMusicVol(v); Music.setVolume(v); }}
        />
      )}

      <div className="settings-section">
        <div className="settings-row settings-row-flush">
          <span className="settings-label">{v.remind.label}</span>
          <button
            type="button"
            className="pixel-btn pixel-btn-small"
            onClick={toggleReminder}
            disabled={!remindersAvailable()}
            aria-pressed={!!settings?.reminderOn}
          >
            {settings?.reminderOn ? 'ON' : 'OFF'}
          </button>
        </div>
        <p className="settings-help">
          {remindersAvailable() ? v.remind.help : v.remind.webOnly}
        </p>
        {settings?.reminderOn && (
          <label className="settings-time">
            <span>AT</span>
            <select
              value={reminderTimeOf(settings)}
              onChange={(e) => onSetSetting('reminderTime', e.target.value)}
              aria-label="Reminder time"
            >
              {REMINDER_TIMES.map((t) => <option key={t} value={t}>{formatReminderTime(t)}</option>)}
            </select>
          </label>
        )}
        {remindNote && <p className="settings-note err">{remindNote}</p>}
      </div>

      {canPin && (
        <div className="settings-row">
          <span>HOME SCREEN WIDGET</span>
          <button type="button" className="pixel-btn pixel-btn-small" onClick={() => pinWidget().catch(() => setCanPin(false))}>
            ADD
          </button>
        </div>
      )}

      <div className="settings-section">
        <div className="settings-label">TEXT SIZE</div>
        <div className="cutoff-row" role="radiogroup" aria-label="Text size">
          {[['normal', 'NORMAL'], ['large', 'LARGE']].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={(settings?.textSize || 'normal') === id}
              className={`choice-btn${(settings?.textSize || 'normal') === id ? ' active' : ''}`}
              onClick={() => onSetSetting('textSize', id)}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="settings-note-quiet">Makes the panels, buttons and dialogs easier to read.</p>
      </div>

      <div className="settings-section">
        <div className="settings-label">WORLD</div>
        <div className="cutoff-row" role="radiogroup" aria-label="Theme">
          {Object.values(THEMES).map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={(settings?.theme || 'medieval') === t.id}
              className={`choice-btn${(settings?.theme || 'medieval') === t.id ? ' active' : ''}`}
              onClick={() => onSetSetting('theme', t.id)}
            >
              {t.name}
            </button>
          ))}
        </div>
        <p className="settings-note-quiet">
          The room, its creatures and its music change. Your record does not.
        </p>
      </div>

      <div className="settings-row">
        <span>{v.settings.guide}</span>
        <button type="button" className="pixel-btn pixel-btn-small" onClick={onOpenGuide}>
          READ
        </button>
      </div>

      <div className="settings-section">
        <div className="settings-label">{v.settings.dayTurns}</div>
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
            ? v.settings.midnight
            : v.settings.before(cutoff)}
        </p>
      </div>

      <div className="settings-section">
        <div className="settings-label">{v.settings.record}</div>
        <p className="settings-help">
          Everything stays on this device. Keep a copy somewhere safe so a lost
          phone doesn&rsquo;t take the streak with it.
        </p>
        <p className={`settings-note-quiet${backup.overdue ? ' warn' : ''}`}>
          {backup.label}
          {backup.tracked > 0 && ` · ${backup.tracked} ${v.settings.daysOf}`}
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
          <div className="settings-label">{v.settings.retired}</div>
          <p className="settings-help">
            {v.settings.retiredHelp}
          </p>
          <ul className="archived-list">
            {archived.map((r) => (
              <li key={r.id} className="archived-row">
                <span className="archived-name">
                  {r.name}
                  <span className="archived-meta">
                    {r.completed.length} {r.completed.length === 1 ? v.wall.one : v.wall.many}
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
