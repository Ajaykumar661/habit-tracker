import { useEffect, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { renderShareCard, shareCardImage, downloadCard, cardFilename } from '../lib/shareCard';
import { useVoice } from '../hooks/useVoice';
import { Capacitor } from '@capacitor/core';

// The card is drawn when the dialog opens, shown as a preview, and only
// leaves the device if the user presses SHARE (or SAVE in a browser).
export default function ShareCardModal({ open, onClose, card }) {
  const words = useVoice().share;
  const [blob, setBlob] = useState(null);
  const [url, setUrl] = useState(null);
  const [note, setNote] = useState(null);     // { kind: 'ok' | 'err', text }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    let made = null;
    setBlob(null); setUrl(null); setNote(null);
    renderShareCard({ ...card, words })
      .then((b) => {
        if (!alive) return;
        made = URL.createObjectURL(b);
        setBlob(b);
        setUrl(made);
      })
      .catch(() => alive && setNote({ kind: 'err', text: words.failed }));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
    // drawn once per opening, from what the wall shows at that moment
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const filename = cardFilename(card?.name);

  async function share() {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const how = await shareCardImage(blob, filename);
      if (how === 'shared') setNote({ kind: 'ok', text: words.shared });
      if (how === 'saved') setNote({ kind: 'ok', text: words.saved });
    } catch (e) {
      setNote({ kind: 'err', text: String(e?.message || e).toUpperCase() });
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="modal-title">{words.title}</div>
      <div className="share-preview">
        {url ? <img src={url} alt="Your share card" /> : <p className="share-drawing">{note ? '' : words.drawing}</p>}
      </div>
      <div className="share-actions">
        <button type="button" className="pixel-btn" onClick={share} disabled={!blob || busy}>
          {words.share}
        </button>
        {!Capacitor.isNativePlatform() && (
          <button type="button" className="pixel-btn pixel-btn-small" disabled={!blob}
            onClick={() => { downloadCard(blob, filename); setNote({ kind: 'ok', text: words.saved }); }}>
            {words.save}
          </button>
        )}
      </div>
      {note && <p className={`settings-note${note.kind === 'err' ? ' err' : ''}`}>{note.text}</p>}
    </ModalOverlay>
  );
}
