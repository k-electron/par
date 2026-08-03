import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/ui/App';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Expected #root in index.html');
}

// The theme lives inside App, because it depends on stored appearance
// preferences and App is what owns storage.
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
