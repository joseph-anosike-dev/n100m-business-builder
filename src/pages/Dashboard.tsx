import { Icon } from '../components/Icon';
import { PageHeader } from '../components/PageHeader';
import { Link } from '../app/router';
import { getModule, type ModuleId } from '../app/navigation';
import { useDiscoveryStatus } from '../workbooks/useDiscoveryStatus';
import { DiscoveryCard } from './DiscoveryCard';

const JUMP_TO: ModuleId[] = ['offers', 'leads', 'models', 'roadmap', 'business', 'library'];

export function Dashboard() {
  const discovery = useDiscoveryStatus();
  return (
    <div className="page">
      <PageHeader
        title="Dashboard"
        description="Where your business stands and what to do next."
      />

      <DiscoveryCard load={discovery} />

      <div className="dash-grid">
        <section className="card" aria-labelledby="recommended-title">
          <h2 id="recommended-title" className="card__title">
            Recommended next
          </h2>
          <p className="muted">
            Finish Business Discovery and your next step shows up here.
          </p>
        </section>
        <section className="card" aria-labelledby="continue-title">
          <h2 id="continue-title" className="card__title">
            Continue where you left off
          </h2>
          <p className="muted">Nothing in progress yet. Work you start appears here.</p>
        </section>
      </div>

      <section aria-labelledby="jump-title" className="jump">
        <h2 id="jump-title" className="section-title">
          Jump to
        </h2>
        <ul className="jump__list">
          {JUMP_TO.map((id) => {
            const mod = getModule(id);
            return (
              <li key={id}>
                <Link to={mod.path} className="jump__link">
                  <Icon name={mod.icon} />
                  <span className="jump__text">
                    <span className="jump__label">{mod.label}</span>
                    <span className="jump__desc">{mod.description}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
