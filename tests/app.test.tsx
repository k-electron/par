import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app/ui/App';
import { theme } from '../src/app/theme/theme';

function renderApp() {
  return render(
    <ThemeProvider theme={theme}>
      <App />
    </ThemeProvider>,
  );
}

describe('the placeholder page', () => {
  it('names the game in the one top-level heading', () => {
    renderApp();

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Par');
  });

  it('renders inside a main landmark', () => {
    renderApp();

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
