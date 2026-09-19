import { useEffect, useRef, useState } from 'react';
import ModalOverlay from './ModalOverlay';
import { todayStr } from '../lib/dates';

export default function AddRoutineModal({ open, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const nameRef = useRef(null);

  useEffect(() => {
    if (open) {
      setName('');
      setStartDate(todayStr());
      setTimeout(() => nameRef.current && nameRef.current.focus(), 50);
    }
  }, [open]);

  function handleCreate() {
    onCreate(name.trim() || 'MY ROUTINE', startDate || todayStr());
  }

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="modal-title">NEW ROUTINE</div>
      <div className="modal-body">
        <label className="field-label" htmlFor="newRoutineName">ROUTINE NAME</label>
        <input
          id="newRoutineName"
          ref={nameRef}
          className="pixel-input"
          type="text"
          maxLength={28}
          placeholder="E.G. READ 20 PAGES"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
        />
        <label className="field-label" htmlFor="newRoutineStart">START DATE</label>
        <input
          id="newRoutineStart"
          className="pixel-input"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div className="modal-actions">
        <button className="pixel-btn pixel-btn-small" type="button" onClick={handleCreate}>CREATE</button>
        <button className="pixel-btn pixel-btn-small" type="button" onClick={onClose}>CANCEL</button>
      </div>
    </ModalOverlay>
  );
}
