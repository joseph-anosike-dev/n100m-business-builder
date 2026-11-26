import type { ReactNode } from 'react';

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <h2 className="empty__title">{title}</h2>
      {children ? <p className="empty__body">{children}</p> : null}
    </div>
  );
}
