import { describe, expect, it } from 'vitest';
import { isActive } from './paths';

describe('isActive', () => {
  it('matches "/" only against the exact root path', () => {
    expect(isActive('/', '/')).toBe(true);
    expect(isActive('/offers', '/')).toBe(false);
    expect(isActive('/offers/x', '/')).toBe(false);
    expect(isActive('', '/')).toBe(false);
  });

  it('matches a module path exactly', () => {
    expect(isActive('/offers', '/offers')).toBe(true);
  });

  it('matches sub-paths of a module', () => {
    expect(isActive('/offers/some-offer', '/offers')).toBe(true);
    expect(isActive('/offers/a/b/c', '/offers')).toBe(true);
  });

  it('does not match a different module or the Dashboard', () => {
    expect(isActive('/leads', '/offers')).toBe(false);
    expect(isActive('/', '/offers')).toBe(false);
  });

  it('does not match on a shared name prefix without a "/" boundary', () => {
    expect(isActive('/offersheet', '/offers')).toBe(false);
    expect(isActive('/offers-old', '/offers')).toBe(false);
  });

  it('does not match a parent when given the child as the module path', () => {
    expect(isActive('/offers', '/offers/x')).toBe(false);
  });
});
