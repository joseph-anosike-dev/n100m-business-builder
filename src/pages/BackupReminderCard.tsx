import { Link } from '../app/router';
import type { BackupReminder } from '../backup/reminder';

/** Passive Dashboard prompt (spec 12.3 item 3). Renders nothing when no backup is needed. */
export function BackupReminderCard({ reminder }: { reminder: BackupReminder }) {
  if (reminder.kind === 'none') return null;
  const body =
    reminder.kind === 'never'
      ? 'You have not backed up yet. Your work is stored only on this device, so a backup is how you keep it safe.'
      : `Your last backup was ${reminder.days} ${reminder.days === 1 ? 'day' : 'days'} ago. A fresh backup keeps your recent work safe.`;
  return (
    <section className="card" aria-labelledby="backup-reminder-title">
      <h2 id="backup-reminder-title" className="card__title">
        Back up your work
      </h2>
      <p className="muted">{body}</p>
      <div className="backup__actions">
        <Link to="/settings" className="btn btn--primary">
          Go to Settings
        </Link>
      </div>
    </section>
  );
}
