import { Icon } from '../components/Icon';
import { Link } from './router';
import { MORE_IN_BAR } from './navigation';
import { Wordmark } from './Wordmark';

/** Mobile only (hidden from 768px up, where the sidebar takes over). */
export function TopBar({
  showBack,
  onOpenMore,
}: {
  showBack: boolean;
  onOpenMore: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar__start">
        {showBack ? (
          <Link to="/" className="icon-btn" aria-label="Back to Dashboard">
            <Icon name="back" />
          </Link>
        ) : null}
        <Wordmark />
      </div>
      {MORE_IN_BAR ? null : (
        <button type="button" className="more-btn" onClick={onOpenMore}>
          <Icon name="more" />
          <span>More</span>
        </button>
      )}
    </header>
  );
}
