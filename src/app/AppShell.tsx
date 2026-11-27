import { useEffect, useRef, useState } from 'react';
import { useNativeShell } from '../native/useNativeShell';
import { Screen } from '../routes';
import { UnsavedBanner } from '../workbooks/UnsavedBanner';
import { BottomNav } from './BottomNav';
import { MoreSheet } from './MoreSheet';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { isOffBar, moduleForPath } from './navigation';
import { useRoute } from './router';

const APP_NAME = 'N100M Business Builder';

export function AppShell() {
  const path = useRoute();
  useNativeShell();
  const mod = moduleForPath(path);
  const [moreOpen, setMoreOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(path);

  useEffect(() => {
    setMoreOpen(false);
    document.title = mod && mod.id !== 'dashboard' ? `${mod.label} – ${APP_NAME}` : APP_NAME;
    if (previousPath.current !== path) {
      previousPath.current = path;
      // Land on the new screen: scroll to the top and move focus there so
      // keyboard and screen-reader users are not left on the old link.
      mainRef.current?.scrollTo(0, 0);
      mainRef.current?.focus({ preventScroll: true });
    }
  }, [path, mod]);

  return (
    <div className="shell" data-rail={railExpanded ? 'expanded' : 'collapsed'}>
      <button
        type="button"
        className="skip-link"
        onClick={() => mainRef.current?.focus()}
      >
        Skip to content
      </button>
      <TopBar showBack={isOffBar(mod?.id)} onOpenMore={() => setMoreOpen(true)} />
      <Sidebar expanded={railExpanded} onToggle={() => setRailExpanded((v) => !v)} />
      <main id="main-content" ref={mainRef} tabIndex={-1} className="main">
        <UnsavedBanner />
        <Screen path={path} />
      </main>
      <BottomNav onOpenMore={() => setMoreOpen(true)} />
      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
    </div>
  );
}
