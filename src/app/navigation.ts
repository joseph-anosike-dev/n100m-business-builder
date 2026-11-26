import type { IconName } from '../components/Icon';
import { isActive } from './paths';

// Single source of truth for navigation (spec sections 5.3 and 6).
// Data only: no React in this file, so layouts can be changed without
// touching the modules themselves.

export type ModuleId =
  | 'dashboard'
  | 'discovery'
  | 'offers'
  | 'leads'
  | 'models'
  | 'roadmap'
  | 'business'
  | 'library'
  | 'settings';

export interface ModuleDef {
  id: ModuleId;
  path: string;
  /** Full name, used in the sidebar and page titles. */
  label: string;
  /** Compact name for the bottom bar. */
  shortLabel: string;
  /** One line describing the module. */
  description: string;
  icon: IconName;
  /** Placeholder copy shown until the module is built. */
  emptyNote: string;
}

/** Spec order (section 2.3). Sidebar and rail render in this order. */
export const MODULES: ModuleDef[] = [
  {
    id: 'dashboard',
    path: '/',
    label: 'Dashboard',
    shortLabel: 'Dashboard',
    description: 'Where you stand and what to do next.',
    icon: 'dashboard',
    emptyNote: '',
  },
  {
    id: 'discovery',
    path: '/discovery',
    label: 'Business Discovery',
    shortLabel: 'Discovery',
    description: 'Find out where your business is today and where to start.',
    icon: 'discovery',
    emptyNote: 'The guided questions and your Business Profile will appear here.',
  },
  {
    id: 'offers',
    path: '/offers',
    label: 'Offers',
    shortLabel: 'Offers',
    description: 'Build and refine what you sell.',
    icon: 'offers',
    emptyNote: 'Offers you build will be listed here with their progress.',
  },
  {
    id: 'leads',
    path: '/leads',
    label: 'Leads',
    shortLabel: 'Leads',
    description: 'Plan how you find customers.',
    icon: 'leads',
    emptyNote: 'Your lead plans will be listed here with their progress.',
  },
  {
    id: 'models',
    path: '/models',
    label: 'Money Models',
    shortLabel: 'Models',
    description: 'Model how your revenue works.',
    icon: 'models',
    emptyNote: 'Your money models will be listed here with their progress.',
  },
  {
    id: 'roadmap',
    path: '/roadmap',
    label: 'Scaling Roadmap',
    shortLabel: 'Roadmap',
    description: 'A staged plan with tasks.',
    icon: 'roadmap',
    emptyNote: 'Your roadmap stages and tasks will appear here.',
  },
  {
    id: 'business',
    path: '/business',
    label: 'My Business',
    shortLabel: 'My Business',
    description: 'Everything you have saved, plus notes and files.',
    icon: 'business',
    emptyNote: 'Your saved work, notes and attachments will be collected here.',
  },
  {
    id: 'library',
    path: '/library',
    label: 'Knowledge Library',
    shortLabel: 'Library',
    description: 'Reference lessons and PDFs.',
    icon: 'library',
    emptyNote: 'Lessons and PDFs, bundled and imported, will be browsable here.',
  },
  {
    id: 'settings',
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    description: 'Appearance, backup, import and export.',
    icon: 'settings',
    emptyNote: '',
  },
];

const BY_ID = new Map(MODULES.map((m) => [m.id, m]));

export function getModule(id: ModuleId): ModuleDef {
  const found = BY_ID.get(id);
  if (!found) throw new Error(`Unknown module: ${id}`);
  return found;
}

/** Most specific module whose path matches, or undefined for unknown paths. */
export function moduleForPath(path: string): ModuleDef | undefined {
  return MODULES.filter((m) => isActive(path, m.path)).sort(
    (a, b) => b.path.length - a.path.length,
  )[0];
}

// ---------------------------------------------------------------------------
// Mobile layout (below 768px).
//
// Spec D2: the bar is Dashboard, Offers, Leads, Models.
// Spec D14 (open): how the other modules are reached on mobile.
//
// Current choice: bar stays at four items and a "More" button in the top app
// bar opens a sheet with MORE_MENU. To switch to a fifth "More" tab instead,
// append `{ kind: 'more' }` to MOBILE_BAR: the top-bar button hides itself
// and the tab opens the same sheet. Nothing else needs to change.
// ---------------------------------------------------------------------------

export type BarEntry = { kind: 'module'; id: ModuleId } | { kind: 'more' };

export const MOBILE_BAR: BarEntry[] = [
  { kind: 'module', id: 'dashboard' },
  { kind: 'module', id: 'offers' },
  { kind: 'module', id: 'leads' },
  { kind: 'module', id: 'models' },
];

/** Reachable from the More sheet on mobile. Discovery is reached from the Dashboard. */
export const MORE_MENU: ModuleId[] = ['roadmap', 'business', 'library', 'settings'];

export const MORE_IN_BAR = MOBILE_BAR.some((e) => e.kind === 'more');

const BAR_MODULE_IDS = new Set(
  MOBILE_BAR.flatMap((e) => (e.kind === 'module' ? [e.id] : [])),
);

/** True when the mobile bar has no tab for this module (so a back button helps). */
export function isOffBar(id: ModuleId | undefined): boolean {
  return id !== undefined && !BAR_MODULE_IDS.has(id);
}
