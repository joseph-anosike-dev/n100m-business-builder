export function Wordmark({ withName = false }: { withName?: boolean }) {
  return (
    <span className="wordmark">
      <span className="wordmark__mark" aria-hidden="true">
        ₦
      </span>
      <span className="wordmark__text">
        <span className="wordmark__name">N100M</span>
        {withName ? <span className="wordmark__sub">Business Builder</span> : null}
      </span>
    </span>
  );
}
