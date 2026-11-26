import { describe, expect, it } from 'vitest';
import { resolveBack, type BackAction } from './backBehaviour';
import { MODULES } from './navigation';

const DASHBOARD: BackAction = { kind: 'exit' };
const toDashboard: BackAction = { kind: 'navigate', to: '/' };

describe('resolveBack: Dashboard', () => {
  it('exits from the Dashboard path "/"', () => {
    expect(resolveBack('/')).toEqual(DASHBOARD);
  });

  it('treats an empty path as the Dashboard', () => {
    expect(resolveBack('')).toEqual(DASHBOARD);
  });
});

describe('resolveBack: module roots', () => {
  // Driven by the real navigation config, so a newly added module is covered
  // without touching this file.
  const roots = MODULES.filter((m) => m.path !== '/');

  it('has module roots to test', () => {
    expect(roots.length).toBeGreaterThan(0);
  });

  it.each(roots.map((m) => [m.id, m.path]))(
    'goes from the %s root (%s) to the Dashboard',
    (_id, path) => {
      expect(resolveBack(path)).toEqual(toDashboard);
    },
  );

  it('uses "/" as the only module path that exits', () => {
    const exiting = MODULES.filter((m) => resolveBack(m.path).kind === 'exit');
    expect(exiting.map((m) => m.id)).toEqual(['dashboard']);
  });
});

describe('resolveBack: screens below a module root', () => {
  it('goes up one level from a sub-screen', () => {
    expect(resolveBack('/offers/some-offer')).toEqual({ kind: 'navigate', to: '/offers' });
  });

  it('goes up exactly one level from a deeper screen', () => {
    expect(resolveBack('/offers/some-offer/edit')).toEqual({
      kind: 'navigate',
      to: '/offers/some-offer',
    });
    expect(resolveBack('/roadmap/stage-1/task-2/notes')).toEqual({
      kind: 'navigate',
      to: '/roadmap/stage-1/task-2',
    });
  });

  it('keeps ids that contain dashes, dots or digits intact', () => {
    expect(resolveBack('/library/lesson-1.2/page-3')).toEqual({
      kind: 'navigate',
      to: '/library/lesson-1.2',
    });
  });
});

describe('resolveBack: unknown and unusual paths', () => {
  it('sends an unknown top-level path to the Dashboard', () => {
    expect(resolveBack('/does-not-exist')).toEqual(toDashboard);
  });

  it('ignores a trailing slash', () => {
    expect(resolveBack('/offers/')).toEqual(toDashboard);
    expect(resolveBack('/offers/some-offer/')).toEqual({ kind: 'navigate', to: '/offers' });
  });

  it('does not throw and always returns a valid action for odd input', () => {
    const odd = ['//', '///', '/ ', ' ', 'offers', 'offers/x', '/a//b', '/%20/x', '/\u00e9/\u00fc', '/'.repeat(500)];
    for (const path of odd) {
      let action: BackAction | undefined;
      expect(() => {
        action = resolveBack(path);
      }, `path ${JSON.stringify(path)}`).not.toThrow();
      expect(action).toBeDefined();
      if (action!.kind === 'navigate') {
        expect(action!.to.startsWith('/')).toBe(true);
      }
    }
  });

  it('does not throw on very long paths', () => {
    const deep = '/' + Array.from({ length: 2000 }, (_, i) => `s${i}`).join('/');
    expect(resolveBack(deep).kind).toBe('navigate');
  });
});

describe('resolveBack: properties', () => {
  it('is deterministic', () => {
    expect(resolveBack('/offers/x')).toEqual(resolveBack('/offers/x'));
  });

  it('always moves somewhere other than the current path', () => {
    for (const path of ['/offers', '/offers/x', '/offers/x/y', '/unknown']) {
      const action = resolveBack(path);
      expect(action.kind).toBe('navigate');
      if (action.kind === 'navigate') expect(action.to).not.toBe(path);
    }
  });

  it('reaches the Dashboard and then exits, in at most depth + 1 presses', () => {
    const start = '/roadmap/stage-1/task-2/notes';
    const depth = start.split('/').filter(Boolean).length;
    const visited: string[] = [start];
    let path = start;
    let exited = false;

    for (let presses = 0; presses <= depth + 1; presses++) {
      const action = resolveBack(path);
      if (action.kind === 'exit') {
        exited = true;
        break;
      }
      path = action.to;
      visited.push(path);
    }

    expect(exited).toBe(true);
    expect(visited).toEqual([
      '/roadmap/stage-1/task-2/notes',
      '/roadmap/stage-1/task-2',
      '/roadmap/stage-1',
      '/roadmap',
      '/',
    ]);
  });
});
