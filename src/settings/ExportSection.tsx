import { useState } from 'react';
import { ExportError, runMarkdownExport } from '../export/markdownExport';
import { deliverFile } from '../native/deliverFile';
import { getStorage } from '../storage';
import { ExportSectionView, type ExportStatus } from './ExportSectionView';

export function ExportSection() {
  const [status, setStatus] = useState<ExportStatus>({ kind: 'idle' });

  const onExport = () => {
    setStatus({ kind: 'working' });
    runMarkdownExport(getStorage(), (bytes, filename) =>
      deliverFile(bytes, filename, 'application/zip', 'Save your export'),
    )
      .then((result) => setStatus({ kind: 'exported', result }))
      .catch((e: unknown) =>
        setStatus({ kind: 'error', message: e instanceof ExportError ? e.message : 'The export failed.' }),
      );
  };

  return <ExportSectionView status={status} onExport={onExport} />;
}
