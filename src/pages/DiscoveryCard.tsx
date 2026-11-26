import { Link } from '../app/router';

export type DiscoveryState = 'not-started' | 'in-progress' | 'complete';

// Wording from spec 5.3: Start -> Continue -> Review.
const COPY: Record<DiscoveryState, { title: string; body: string; action: string }> = {
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
    body: 'See your profile and the path we suggested.',
    action: 'Review profile',
  },
};

export function DiscoveryCard({ state }: { state: DiscoveryState }) {
  const copy = COPY[state];
  return (
    <section className="hero" aria-labelledby="discovery-card-title">
      <h2 id="discovery-card-title" className="hero__title">
        {copy.title}
      </h2>
      <p className="hero__body">{copy.body}</p>
      <Link to="/discovery" className="btn btn--accent">
        {copy.action}
      </Link>
    </section>
  );
}
