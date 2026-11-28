import { PageHeader } from '../components/PageHeader';
import { BackupSection } from '../settings/BackupSection';
import { ExportSection } from '../settings/ExportSection';
import { StorageStatusCard } from '../settings/StorageStatusCard';
import { useTheme, type ThemePreference } from '../settings/theme';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export function Settings() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="page">
      <PageHeader title="Settings" description="Appearance, backup, import and export." />

      <section className="card" aria-labelledby="general-title">
        <h2 id="general-title" className="card__title">
          General
        </h2>
        <fieldset className="segmented">
          <legend className="segmented__legend">Theme</legend>
          <div className="segmented__row">
            {THEMES.map((t) => (
              <label key={t.value} className="segmented__option">
                <input
                  type="radio"
                  name="theme"
                  value={t.value}
                  checked={preference === t.value}
                  onChange={() => setPreference(t.value)}
                />
                <span>{t.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <BackupSection />

      <ExportSection />

      <StorageStatusCard />

      <p className="muted">
        Currency, Markdown import and AI options will be added in later releases.
      </p>
    </div>
  );
}
