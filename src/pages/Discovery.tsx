import { Link, useRoute } from '../app/router';
import { PageHeader } from '../components/PageHeader';
import { PROFILE_ROUTE } from '../workbooks/profile';
import { WORKBOOKS } from '../workbooks/registry';
import { BusinessProfile } from './BusinessProfile';
import { WorkbookPage } from './WorkbookPage';

/** /discovery lists workbooks; /discovery/profile is the Business Profile; /discovery/<workbook-id> opens a workbook. */
export function Discovery() {
  const path = useRoute();
  const rest = path.replace(/^\/discovery\/?/, '');
  if (path === PROFILE_ROUTE) return <BusinessProfile />;
  if (rest !== '') return <WorkbookPage workbookId={decodeURIComponent(rest.split('/')[0])} />;

  return (
    <div className="page">
      <PageHeader
        title="Business Discovery"
        description="Find out where your business is today and where to start."
      />
      <p className="muted">
        Work through the workbooks below at your own pace. Your answers save on this device as you go, so you can
        leave and come back.
      </p>
      {WORKBOOKS.map((w) => (
        <section key={w.id} className="card" aria-labelledby={`wb-card-${w.id}`}>
          <h2 id={`wb-card-${w.id}`} className="card__title">
            {w.title}
          </h2>
          <p className="muted">{w.description}</p>
          <div>
            <Link to={`/discovery/${w.id}`} className="btn btn--primary">
              Open workbook
            </Link>
          </div>
        </section>
      ))}
    </div>
  );
}
