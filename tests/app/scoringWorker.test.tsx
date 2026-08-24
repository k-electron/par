/**
 * The scoring worker's lifecycle, under the StrictMode the app actually ships.
 *
 * Nothing covered this. Every other suite hands `App` a direct scorer, which is
 * the right thing for testing what a score says and the reason a broken worker
 * could sit in `main` with 577 green tests above it: the dev server never scored
 * a round, because `StrictMode` terminated the one worker the app kept holding.
 *
 * So the worker here is a fake — the real one needs a browser — but the
 * lifecycle is the real one. `main.tsx` renders inside `StrictMode`, so these
 * mount inside `StrictMode` too, and what they assert is that the worker the app
 * sends its round to is a worker that is still alive.
 */

import { cleanup, render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scoreDirectly } from '../../src/app/scoring/direct';
import type { ScoreRequest, ScoreResponse } from '../../src/app/scoring/protocol';
import { Repository } from '../../src/app/storage/repository';
import { createMemoryStorage } from '../../src/app/storage/storage';
import { App } from '../../src/app/ui/App';
import { INSTANT_REVEAL } from '../../src/app/ui/reveal';
import { answers, starters } from '../../src/data';
import { drawPuzzle } from '../../src/engine/daily/puzzle';

const FIXED_NOW = new Date('2026-06-15T16:00:00Z');
const PUZZLE = drawPuzzle(165, { answers, starters });

/**
 * A worker that records what it was sent and whether it is still alive.
 *
 * **Termination has to mean death here, or the fake is useless.** A real
 * terminated worker delivers nothing ever again, which is why the bug presented
 * as a round that hung rather than as an error. So this one keeps recording what
 * it is posted — that is how a test can say the request went somewhere dead —
 * and refuses to answer once terminated.
 */
class FakeWorker {
  static built: FakeWorker[] = [];

  readonly requests: ScoreRequest[] = [];
  terminated = false;

  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  // The URL and options the client passes are ignored: nothing here loads a
  // script, and asserting on them would only check that the call still looks
  // the way it looks.
  constructor() {
    FakeWorker.built.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void): void {
    const forType = this.listeners.get(type) ?? new Set();
    forType.add(listener);
    this.listeners.set(type, forType);
  }

  removeEventListener(type: string, listener: (event: unknown) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(request: ScoreRequest): void {
    this.requests.push(request);
  }

  terminate(): void {
    this.terminated = true;
  }

  /** Reply to everything asked of it, the way the real worker does. */
  answer(response: (request: ScoreRequest) => ScoreResponse): void {
    if (this.terminated) return;

    for (const request of this.requests) {
      for (const listener of this.listeners.get('message') ?? []) {
        listener({ data: response(request) });
      }
    }
  }

  static get alive(): FakeWorker[] {
    return FakeWorker.built.filter((worker) => !worker.terminated);
  }

  static get asked(): FakeWorker[] {
    return FakeWorker.built.filter((worker) => worker.requests.length > 0);
  }
}

function mountInStrictMode() {
  return render(
    <StrictMode>
      <App
        repository={new Repository(createMemoryStorage())}
        now={FIXED_NOW}
        // The reveal is not what this file is about, and waiting on it would
        // only make the round slower to play.
        reveal={INSTANT_REVEAL}
      />
    </StrictMode>,
  );
}

async function playAWinningRound() {
  const user = userEvent.setup();
  mountInStrictMode();

  await user.click(screen.getByRole('button', { name: 'Start' }));
  await user.keyboard(`${PUZZLE.answer}{Enter}`);
}

beforeEach(() => {
  FakeWorker.built = [];
  vi.stubGlobal('Worker', FakeWorker);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the app\u2019s own scoring worker', () => {
  it('terminates nothing of its own accord', async () => {
    // The fix, stated directly. StrictMode mounts, tears down and mounts again;
    // the app used to take that as its cue to terminate the worker it was
    // keeping, and there is no unmount here for it to have been reacting to.
    mountInStrictMode();
    expect(FakeWorker.alive).toEqual(FakeWorker.built);

    await playAWinningRound();
    expect(FakeWorker.alive).toEqual(FakeWorker.built);
  });

  it('sends the finished round to a worker that is still alive', async () => {
    // The bug in one assertion. The app used to post to the worker its cleanup
    // had already terminated, so the request went into a dead thread and the
    // promise behind it never settled.
    await playAWinningRound();

    expect(FakeWorker.asked).toHaveLength(1);
    expect(FakeWorker.asked[0]?.terminated).toBe(false);
  });

  it('shows the score the worker sends back', async () => {
    await playAWinningRound();

    // Until it answers, the results view says it is working rather than showing
    // a blank.
    expect(await screen.findByText(/working out your round/i)).toBeInTheDocument();

    const expected = scoreDirectly({
      guesses: [PUZZLE.starter, PUZZLE.answer],
      answer: PUZZLE.answer,
      tookHouseStarter: true,
      hardMode: false,
    });

    const asked = FakeWorker.asked[0];
    expect(asked, 'a live worker should have been asked').toBeDefined();
    act(() => {
      asked!.answer((request) => ({ id: request.id, ok: true, score: expected }));
    });

    expect(await screen.findByText(expected.total.toFixed(1))).toBeInTheDocument();
  });

  it('asks for the round that was actually played', async () => {
    await playAWinningRound();

    expect(FakeWorker.asked[0]?.requests[0]).toMatchObject({
      guesses: [PUZZLE.starter, PUZZLE.answer],
      answer: PUZZLE.answer,
      tookHouseStarter: true,
      hardMode: false,
    });
  });

  it('spawns none at all when a scorer is supplied', () => {
    // Which is what every other suite does, and why they could not have caught
    // this.
    render(
      <StrictMode>
        <App
          repository={new Repository(createMemoryStorage())}
          now={FIXED_NOW}
          scoring={{ score: () => Promise.reject(new Error('unused')), dispose: () => {} }}
        />
      </StrictMode>,
    );

    expect(FakeWorker.built).toEqual([]);
  });

  it('asks one worker for the round, whatever StrictMode built', async () => {
    // StrictMode double-invokes the initialiser, so development builds a spare
    // client. It must stay a spare: two workers scoring the same round would be
    // wasted work at best, and the sort of thing that goes unnoticed at worst.
    await playAWinningRound();

    expect(FakeWorker.asked).toHaveLength(1);
    expect(FakeWorker.asked[0]?.requests).toHaveLength(1);
  });
});
