import { Router } from './app/router';
import { AppShell } from './app/AppShell';
import { ThemeProvider } from './settings/theme';

export function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppShell />
      </Router>
    </ThemeProvider>
  );
}
