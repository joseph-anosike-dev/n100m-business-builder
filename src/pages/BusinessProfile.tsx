import { Link } from '../app/router';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { discoveryRoute } from '../workbooks/discoveryStatus';
import type { ProfileEntry } from '../workbooks/profile';
import { useBusinessProfile, type ProfileLoad } from '../workbooks/useBusinessProfile';

/** Business Profile screen (spec S13): a read-only view of the Business Self-Assessment answers. */
export function BusinessProfile() {
  const { load, retry } = useBusinessProfile();
  return <BusinessProfileView load={load} onRetry={retry} />;
}

function EntryValue({ entry }: { entry: ProfileEntry }) {
  if (typeof entry.value === 'string') return <dd className="profile__text">{entry.value}</dd>;
  return (
    <dd>
      <ul className="profile__list">
        {entry.value.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </dd>
  );
}

/** Presentation only, so it can be rendered for every state. */
export function BusinessProfileView({ load, onRetry }: { load: ProfileLoad; onRetry?: () => void }) {
  const header = (
    <PageHeader title="Business Profile" description="What you told us about yourself, in one place." />
  );

  if (load.kind === 'loading') {
    return (
      <div className="page" aria-busy="true">
        {header}
        <p className="muted">Loading your profile…</p>
      </div>
    );
  }

  if (load.kind === 'error') {
    return (
      <div className="page">
        {header}
        <div className="wb-banner" role="alert">
          <p>
            Your saved answers could not be read right now. Nothing has been changed. Your profile is built from
            those answers, so it cannot be shown until they load.
          </p>
          {onRetry ? (
            <button type="button" className="btn btn--primary" onClick={onRetry}>
              Try again
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  const { profile } = load;
  if (profile.answered === 0) {
    return (
      <div className="page">
        {header}
        <EmptyState title="No profile yet">
          Your profile is built from the Business Self-Assessment. <Link to={discoveryRoute()}>Start the assessment</Link>{' '}
          to create it.
        </EmptyState>
      </div>
    );
  }

  const complete = profile.status === 'complete';
  return (
    <div className="page">
      {header}
      <div className="wb-complete" role="status">
        <p>
          {complete
            ? 'Based on your completed Business Self-Assessment.'
            : `Your assessment is not finished, so this profile is partial (${profile.answered} of ${profile.total} questions answered).`}
        </p>
        <Link to={discoveryRoute()} className="btn btn--primary">
          {complete ? 'Edit your answers' : 'Continue the assessment'}
        </Link>
      </div>
      {profile.sections.map((section) => (
        <section key={section.id} className="card" aria-labelledby={`profile-${section.id}`}>
          <h2 id={`profile-${section.id}`} className="card__title">
            {section.title}
          </h2>
          <dl className="profile__entries">
            {section.entries.map((entry) => (
              <div key={entry.id} className="profile__entry">
                <dt className="profile__label">{entry.label}</dt>
                <EntryValue entry={entry} />
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
