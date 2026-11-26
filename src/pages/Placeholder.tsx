import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { getModule, type ModuleId } from '../app/navigation';

/** Stand-in for modules that are not built yet. Replace per module as each lands. */
export function Placeholder({ id }: { id: ModuleId }) {
  const mod = getModule(id);
  return (
    <div className="page">
      <PageHeader title={mod.label} description={mod.description} />
      <EmptyState title="Not built yet">
        This section is part of the app shell. {mod.emptyNote}
      </EmptyState>
    </div>
  );
}
