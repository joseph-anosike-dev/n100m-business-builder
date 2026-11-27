import { Link } from '../app/router';
import { discoveryRoute } from '../workbooks/discoveryStatus';
import { PROFILE_ROUTE } from '../workbooks/profile';
import type { DiscoveryLoad } from '../workbooks/useDiscoveryStatus';

export type DiscoveryState = 'not-started' | 'in-progress' | 'complete';

// Wording from spec 5.3: Start -> Continue -> Review.
export const DISCOVERY_COPY: Record<DiscoveryState, { title: string; body: string; action: string }> = {
  'not-started': {
    title: 'Start Business Discovery',
    body: 'Tell us where your business is today. You get a suggested place to start.',
    action: 'Start Discovery',
  },
  'in-progress': {
    title: 'Continue Discovery',
    body: 'Pick up where you left off.',
    action: 'Continue Discovery',
  },
  complete: {
    title: 'Review Business Profile',
    body: 'See a summary of what you told us about yourself.',
    action: 'Review profile',
  },
};

/** Card for a known state. Start and Continue open the Business Self-Assessment; Review opens the Business Profile. */
export function DiscoveryCard({ load }: { load: DiscoveryLoad }) {
  if (load.kind === 'loading') {
    return (
      <section className="hero" aria-labelledby="discovery-card-title" aria-busy="true">
        <h2 id="discovery-card-title" className="hero__title">
          Business Discovery
        </h2>
        <p className="hero__body">Checking your saved progress…</p>
      </section>
    );
  }
  const state: DiscoveryState = load.kind === 'ready' ? load.status : 'not-started';
  const copy = DISCOVERY_COPY[state];
  return (
    <section className="hero" aria-labelledby="discovery-card-title">
      <h2 id="discovery-card-title" className="hero__title">
        {copy.title}
      </h2>
      <p className="hero__body">{copy.body}</p>
      {load.kind === 'error' ? (
        <p className="hero__body" role="status">
          Your saved progress could not be read right now. Opening the assessment will not change anything you saved.
        </p>
      ) : null}
      <Link to={state === 'complete' ? PROFILE_ROUTE : discoveryRoute()} className="btn btn--accent">
        {copy.action}
      </Link>
    </section>
  );
}
