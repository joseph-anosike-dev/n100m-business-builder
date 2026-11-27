import { Link } from '../app/router';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { getWorkbook } from '../workbooks/registry';
import { useWorkbookResponse } from '../workbooks/useWorkbookResponse';
import { WorkbookRenderer } from '../workbooks/WorkbookRenderer';
import type { WorkbookDefinition } from '../workbooks/types';

export function WorkbookPage({ workbookId }: { workbookId: string }) {
  const definition = getWorkbook(workbookId);
  if (!definition) {
    return (
      <div className="page">
        <EmptyState title="Workbook not found">
          There is no workbook with that address. <Link to="/discovery">Back to Business Discovery</Link>
        </EmptyState>
      </div>
    );
  }
  return <LoadedWorkbook definition={definition} />;
}

function LoadedWorkbook({ definition }: { definition: WorkbookDefinition }) {
  const { load, answers, saveState, setAnswer, retryLoad, retrySave } = useWorkbookResponse(definition);
  return (
    <div className="page">
      <PageHeader title={definition.title} description={definition.description} />
      {load.kind === 'loading' ? <p className="muted">Loading your saved answers…</p> : null}
      {load.kind === 'error' ? (
        <div className="wb-banner" role="alert">
          <p>
            Your saved answers could not be loaded ({load.message}). Nothing has been changed. The form stays closed so
            your saved work is not overwritten.
          </p>
          <button type="button" className="btn btn--primary" onClick={retryLoad}>
            Try again
          </button>
        </div>
      ) : null}
      {load.kind === 'ready' ? (
        <WorkbookRenderer
          definition={definition}
          answers={answers}
          onAnswer={setAnswer}
          saveState={saveState}
          onRetrySave={retrySave}
        />
      ) : null}
    </div>
  );
}
