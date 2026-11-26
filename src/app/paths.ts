/** "/" matches only itself; any other path also matches its sub-paths. */
export function isActive(path: string, to: string): boolean {
  if (to === '/') return path === '/';
  return path === to || path.startsWith(`${to}/`);
}
