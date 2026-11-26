import { describe, expect, it } from 'vitest';
import {
  MODULES,
  MOBILE_BAR,
  MORE_IN_BAR,
  MORE_MENU,
  getModule,
  isOffBar,
  moduleForPath,
  type ModuleId,
} from './navigation';

// The product's required modules in spec order (spec 2.3). This is the one
// deliberate copy of the spec in this file; everything else is derived from
// the exported configuration.
const SPEC_ORDER: ModuleId[] = [
  'dashboard',
  'discovery',
  'offers',
  'leads',
  'models',
  'roadmap',
  'business',
  'library',
  'settings',
];

const ids = MODULES.map((m) => m.id);
const barIds = MOBILE_BAR.flatMap((e) => (e.kind === 'module' ? [e.id] : []));

describe('MODULES: required modules and order', () => {
  it('contains exactly the nine specified modules, in spec order', () => {
    expect(ids).toEqual(SPEC_ORDER);
  });

  it('has unique module ids', () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique route paths', () => {
    const paths = MODULES.map((m) => m.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('has unique labels and unique short labels', () => {
    expect(new Set(MODULES.map((m) => m.label)).size).toBe(MODULES.length);
    expect(new Set(MODULES.map((m) => m.shortLabel)).size).toBe(MODULES.length);
  });
});

describe('MODULES: route metadata', () => {
  it.each(MODULES.map((m) => [m.id, m]))('%s has a valid single-level path', (_id, m) => {
    // "/" or "/name": lower-case, no spaces, no trailing slash, no nesting.
    expect(m.path).toMatch(/^\/([a-z0-9-]+)?$/);
  });

  it.each(MODULES.map((m) => [m.id, m]))('%s has non-empty display text and an icon', (_id, m) => {
    for (const text of [m.label, m.shortLabel, m.description, m.icon]) {
      expect(typeof text).toBe('string');
      expect(text.trim()).not.toBe('');
    }
  });

  it('gives every unbuilt module placeholder copy', () => {
    // Dashboard and Settings are real screens, so their placeholder note is
    // intentionally empty. Every other module still shows a placeholder.
    const built: ModuleId[] = ['dashboard', 'settings'];
    for (const m of MODULES.filter((m) => !built.includes(m.id))) {
      expect(m.emptyNote.trim(), m.id).not.toBe('');
    }
  });
});

describe('Dashboard', () => {
  it('is the first module and the only one at "/"', () => {
    expect(MODULES[0].id).toBe('dashboard');
    expect(MODULES.filter((m) => m.path === '/').map((m) => m.id)).toEqual(['dashboard']);
  });

  it('is what getModule and moduleForPath return for "/"', () => {
    expect(getModule('dashboard').path).toBe('/');
    expect(moduleForPath('/')?.id).toBe('dashboard');
  });
});

describe('MOBILE_BAR', () => {
  it('is exactly Dashboard, Offers, Leads, Models, in that order', () => {
    expect(barIds).toEqual(['dashboard', 'offers', 'leads', 'models']);
  });

  it('has only module entries today (D14 option 2: More lives in the top bar)', () => {
    // If D14 switches to a fifth "More" tab, this test and the one above are
    // the ones expected to change.
    expect(MOBILE_BAR.every((e) => e.kind === 'module')).toBe(true);
    expect(MORE_IN_BAR).toBe(false);
  });

  it('only refers to modules that exist', () => {
    for (const id of barIds) expect(ids).toContain(id);
  });

  it('has no duplicate entries', () => {
    expect(new Set(barIds).size).toBe(barIds.length);
  });
});

describe('MORE_MENU', () => {
  it('lists Roadmap, My Business, Library and Settings, in that order', () => {
    expect(MORE_MENU).toEqual(['roadmap', 'business', 'library', 'settings']);
  });

  it('only refers to modules that exist, without duplicates', () => {
    for (const id of MORE_MENU) expect(ids).toContain(id);
    expect(new Set(MORE_MENU).size).toBe(MORE_MENU.length);
  });

  it('does not repeat anything already in the bottom bar', () => {
    for (const id of MORE_MENU) expect(barIds).not.toContain(id);
  });
});

describe('Discovery', () => {
  it('is a configured module but is not in the mobile bottom bar', () => {
    expect(ids).toContain('discovery');
    expect(barIds).not.toContain('discovery');
  });

  it('is not in the More menu either (it is reached from the Dashboard card)', () => {
    expect(MORE_MENU).not.toContain('discovery');
  });

  it('is the only module that the mobile bar and More menu do not cover', () => {
    const reachable = new Set<ModuleId>([...barIds, ...MORE_MENU]);
    const unreached = ids.filter((id) => !reachable.has(id));
    expect(unreached).toEqual(['discovery']);
  });

  it('resolves from its configured path', () => {
    expect(moduleForPath(getModule('discovery').path)?.id).toBe('discovery');
  });
});

describe('mobile reachability of the remaining modules', () => {
  it('every module other than Discovery is in the bar or the More menu, never both', () => {
    for (const id of ids.filter((id) => id !== 'discovery')) {
      const inBar = barIds.includes(id);
      const inMore = MORE_MENU.includes(id);
      expect(inBar !== inMore, id).toBe(true);
    }
  });
});

describe('isOffBar', () => {
  it('is false for modules that have a bottom-bar tab', () => {
    for (const id of barIds) expect(isOffBar(id), id).toBe(false);
  });

  it('is true for every module without a bottom-bar tab', () => {
    for (const id of ids.filter((id) => !barIds.includes(id))) {
      expect(isOffBar(id), id).toBe(true);
    }
  });

  it('is false when there is no module', () => {
    expect(isOffBar(undefined)).toBe(false);
  });
});

describe('getModule', () => {
  it('returns the matching definition for every id', () => {
    for (const m of MODULES) expect(getModule(m.id)).toBe(m);
  });

  it('throws for an unknown id', () => {
    expect(() => getModule('nope' as ModuleId)).toThrow(/Unknown module/);
  });
});

describe('moduleForPath', () => {
  it('maps every module path back to that module', () => {
    for (const m of MODULES) expect(moduleForPath(m.path)?.id, m.path).toBe(m.id);
  });

  it('maps sub-screens to their module', () => {
    for (const m of MODULES.filter((m) => m.path !== '/')) {
      expect(moduleForPath(`${m.path}/some-item`)?.id, m.path).toBe(m.id);
      expect(moduleForPath(`${m.path}/a/b`)?.id, m.path).toBe(m.id);
    }
  });

  it('does not match "/" to anything but the Dashboard itself', () => {
    expect(moduleForPath('/offers')?.id).not.toBe('dashboard');
    expect(moduleForPath('/unknown-page')).toBeUndefined();
  });

  it('returns undefined for unknown paths', () => {
    expect(moduleForPath('/nope')).toBeUndefined();
    expect(moduleForPath('/nope/deeper')).toBeUndefined();
  });

  it('does not match a path that only shares a name prefix with a module', () => {
    for (const m of MODULES.filter((m) => m.path !== '/')) {
      expect(moduleForPath(`${m.path}x`), `${m.path}x`).toBeUndefined();
    }
  });
});
