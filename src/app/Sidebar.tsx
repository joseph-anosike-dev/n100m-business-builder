import { Icon } from '../components/Icon';
import { Link } from './router';
import { MODULES } from './navigation';
import { Wordmark } from './Wordmark';

/**
 * 768px and up. A collapsible rail on tablets, a permanent sidebar from 1024px
 * (the toggle is hidden there by CSS). Every module is listed (spec 5.2).
 */
export function Sidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar__head">
        <Wordmark withName />
        <button
          type="button"
          className="icon-btn sidebar__toggle"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls="sidebar-nav"
          aria-label={expanded ? 'Collapse navigation' : 'Expand navigation'}
        >
          <Icon name="collapse" />
        </button>
      </div>
      <nav id="sidebar-nav" aria-label="Main" className="sidebar__nav">
        <ul className="sidebar__list">
          {MODULES.map((mod) => (
            <li
              key={mod.id}
              className="sidebar__item"
              data-pin={mod.id === 'settings' ? 'end' : undefined}
            >
              <Link
                to={mod.path}
                className="nav-item"
                title={expanded ? undefined : mod.label}
              >
                <Icon name={mod.icon} />
                <span className="nav-item__label">{mod.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
