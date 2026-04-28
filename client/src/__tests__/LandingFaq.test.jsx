// Tests for the Landing-page FAQ accordion. This widget is a conversion
// element — it has to open/close correctly and be keyboard-accessible, or
// prospects bouncing off the page get dead clicks.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { I18nProvider } from '../context/I18nContext';
import { ThemeProvider } from '../context/ThemeContext';
import Landing from '../pages/Landing';

function renderLanding() {
  return render(
    <MemoryRouter>
      <I18nProvider>
        <ThemeProvider>
          <Landing />
        </ThemeProvider>
      </I18nProvider>
    </MemoryRouter>
  );
}

describe('Landing FAQ accordion', () => {
  it('renders all six FAQ questions as buttons', () => {
    renderLanding();
    expect(screen.getByRole('button', { name: /is there a free plan\?/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /which review platforms/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how does ai drafting work/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /can i cancel anytime/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /is my data safe/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /multiple locations/i })).toBeInTheDocument();
  });

  it('has the first question expanded by default', () => {
    renderLanding();
    const firstQ = screen.getByRole('button', { name: /is there a free plan\?/i });
    expect(firstQ).toHaveAttribute('aria-expanded', 'true');
    // Its panel region is rendered
    expect(screen.getByText(/free plan is permanent/i)).toBeInTheDocument();
  });

  it('clicking a closed question opens it and closes the previously-open one', async () => {
    renderLanding();
    const user = userEvent.setup();
    const firstQ = screen.getByRole('button', { name: /is there a free plan\?/i });
    const thirdQ = screen.getByRole('button', { name: /how does ai drafting work/i });
    expect(firstQ).toHaveAttribute('aria-expanded', 'true');
    expect(thirdQ).toHaveAttribute('aria-expanded', 'false');

    await user.click(thirdQ);

    expect(firstQ).toHaveAttribute('aria-expanded', 'false');
    expect(thirdQ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/claude \(by anthropic\)/i)).toBeInTheDocument();
  });

  it('clicking an open question closes it (collapsing all)', async () => {
    renderLanding();
    const user = userEvent.setup();
    const firstQ = screen.getByRole('button', { name: /is there a free plan\?/i });
    expect(firstQ).toHaveAttribute('aria-expanded', 'true');

    await user.click(firstQ);

    expect(firstQ).toHaveAttribute('aria-expanded', 'false');
  });

  it('each button exposes aria-controls pointing at a panel id', () => {
    renderLanding();
    const firstQ = screen.getByRole('button', { name: /is there a free plan\?/i });
    const panelId = firstQ.getAttribute('aria-controls');
    expect(panelId).toMatch(/^faq-panel-\d+$/);
    expect(document.getElementById(panelId)).toBeInTheDocument();
  });

  it('keyboard: space key on focused question toggles state', async () => {
    renderLanding();
    const user = userEvent.setup();
    const secondQ = screen.getByRole('button', { name: /which review platforms/i });
    expect(secondQ).toHaveAttribute('aria-expanded', 'false');

    secondQ.focus();
    await user.keyboard(' ');

    expect(secondQ).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('Landing How It Works section', () => {
  it('renders the three numbered steps', () => {
    renderLanding();
    // v2 redesign: "Paste a link, we pull the reviews", "AI writes in your voice", "One tap. It's published."
    expect(screen.getByRole('heading', { name: /paste a link.*pull the reviews/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /ai writes in.*your voice/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /one tap.*it's published/i })).toBeInTheDocument();
  });

  it('has a workflow section heading', () => {
    renderLanding();
    // Heading was translatable-ized via t('landing.howTitle') which resolves
    // to 'Up and running in 3 minutes' in the EN locale (the test default).
    // Match flexibly so a future copy tweak doesn't re-break this.
    expect(screen.getByRole('heading', { name: /up and running|how it works|workflow/i })).toBeInTheDocument();
  });
});
