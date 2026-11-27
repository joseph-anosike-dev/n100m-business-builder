import { Link, useRoute } from '../app/router';
import { PageHeader } from '../components/PageHeader';
import { WORKBOOKS } from '../workbooks/registry';
import { WorkbookPage } from './WorkbookPage';

/** /discovery lists workbooks; /discovery/<workbook-id> opens one. Business Discovery content itself is not built yet. */
export function Discovery() {
  const path = useRoute();
  const rest = path.replace(/^\/discovery\/?/, '');
  if (rest !== '') return <WorkbookPage workbookId={decodeURIComponent(rest.split('/')[0])} />;

  return (
    <div className="page">
      <PageHeader
        title="Business Discovery"
        description="Find out where your business is today and where to start."
      />
      <p className="muted">
        The guided Discovery questions are not built yet. The workbook below is a technical demonstration of the
        workbook engine that they will use.
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
