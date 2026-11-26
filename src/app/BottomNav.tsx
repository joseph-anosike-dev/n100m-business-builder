import { Icon } from '../components/Icon';
import { Link } from './router';
import { MOBILE_BAR, getModule } from './navigation';

/** Mobile only. Rendered entirely from MOBILE_BAR. */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  return (
    <nav className="bottomnav" aria-label="Main">
      <ul className="bottomnav__list">
        {MOBILE_BAR.map((entry) => {
          if (entry.kind === 'more') {
            return (
              <li key="more" className="bottomnav__item">
                <button type="button" className="tab" onClick={onOpenMore}>
                  <span className="tab__icon">
                    <Icon name="more" />
                  </span>
                  <span className="tab__label">More</span>
                </button>
              </li>
            );
          }
          const mod = getModule(entry.id);
          return (
            <li key={mod.id} className="bottomnav__item">
              <Link to={mod.path} className="tab">
                <span className="tab__icon">
                  <Icon name={mod.icon} />
                </span>
                <span className="tab__label">{mod.shortLabel}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
