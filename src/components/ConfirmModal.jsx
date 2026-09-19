import ModalOverlay from './ModalOverlay';

export default function ConfirmModal({ confirm, onYes, onNo }) {
  return (
    <ModalOverlay open={!!confirm} onClose={onNo}>
      {confirm && (
        <>
          <div className="modal-title">{confirm.title}</div>
          <div className="modal-body">{confirm.body}</div>
          <div className="modal-actions">
            <button className="pixel-btn pixel-btn-danger" type="button" onClick={onYes}>YES</button>
            <button className="pixel-btn pixel-btn-small" type="button" onClick={onNo}>CANCEL</button>
          </div>
        </>
      )}
    </ModalOverlay>
  );
}
