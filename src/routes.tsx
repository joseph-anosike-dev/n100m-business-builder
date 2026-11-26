import type { ComponentType } from 'react';
import { moduleForPath, type ModuleId } from './app/navigation';
import { Dashboard } from './pages/Dashboard';
import { NotFound } from './pages/NotFound';
import { Placeholder } from './pages/Placeholder';
import { Settings } from './pages/Settings';

const placeholder = (id: ModuleId): ComponentType => {
  const Page = () => <Placeholder id={id} />;
  Page.displayName = `Placeholder(${id})`;
  return Page;
};

const SCREENS: Record<ModuleId, ComponentType> = {
  dashboard: Dashboard,
  discovery: placeholder('discovery'),
  offers: placeholder('offers'),
  leads: placeholder('leads'),
  models: placeholder('models'),
  roadmap: placeholder('roadmap'),
  business: placeholder('business'),
  library: placeholder('library'),
  settings: Settings,
};

export function Screen({ path }: { path: string }) {
  const mod = moduleForPath(path);
  if (!mod) return <NotFound />;
  const Page = SCREENS[mod.id];
  return <Page />;
}
