import { useEffect, useRef } from 'react';
import { Icon } from '../components/Icon';
import { Link } from './router';
import { MORE_MENU, getModule } from './navigation';

/** Bottom sheet built on the native <dialog>: focus trap, Esc and top layer for free. */
export function MoreSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="more-sheet-title"
      onClose={onClose}
      onClick={(e) => {
        // A click on the dialog element itself is a click on the backdrop.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__inner">
        <div className="sheet__head">
          <h2 id="more-sheet-title" className="sheet__title">
            More
          </h2>
          <button
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>
        <ul className="sheet__list">
          {MORE_MENU.map((id) => {
            const mod = getModule(id);
            return (
              <li key={id}>
                <Link to={mod.path} className="sheet-link" onClick={onClose}>
                  <Icon name={mod.icon} />
                  <span className="sheet-link__text">
                    <span className="sheet-link__label">{mod.label}</span>
                    <span className="sheet-link__desc">{mod.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </dialog>
  );
}
