import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { Link } from '../app/router';

export function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Page not found" />
      <EmptyState title="That address doesn't lead anywhere">
        Check the link, or go back to the Dashboard.
      </EmptyState>
      <p>
        <Link to="/" className="btn btn--primary">
          Go to Dashboard
        </Link>
      </p>
    </div>
  );
}
