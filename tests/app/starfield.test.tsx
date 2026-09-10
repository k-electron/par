import { fireEvent, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Starfield } from '../../src/app/ui/Starfield';

describe('the starfield backdrop', () => {
  const mockCtx = {
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    setTransform: vi.fn(),
    fillStyle: '',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a fixed background canvas with pointer-events none and aria-hidden', () => {
    const { container } = render(<Starfield />);
    const canvas = container.querySelector('canvas');

    expect(canvas).not.toBeNull();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
    expect(canvas?.style.position).toBe('fixed');
    expect(canvas?.style.pointerEvents).toBe('none');
    expect(canvas?.style.zIndex).toBe('-1');
  });

  it('respects prefers-reduced-motion by skipping drawing when reduce is preferred', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame');

    render(<Starfield />);

    // In reduced motion mode, requestAnimationFrame should not be scheduled
    expect(rafSpy).not.toHaveBeenCalled();

    window.matchMedia = originalMatchMedia;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    rafSpy.mockRestore();
  });

  it('runs the animation loop and pauses on visibilitychange', () => {
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const originalGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(mockCtx);

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(123);
    const cafSpy = vi.spyOn(window, 'cancelAnimationFrame');

    const { unmount } = render(<Starfield />);

    expect(rafSpy).toHaveBeenCalled();

    // Tab hidden
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    fireEvent(document, new Event('visibilitychange'));

    expect(cafSpy).toHaveBeenCalledWith(123);

    // Tab visible again
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    fireEvent(document, new Event('visibilitychange'));

    expect(rafSpy).toHaveBeenCalledTimes(2);

    unmount();

    window.matchMedia = originalMatchMedia;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    rafSpy.mockRestore();
    cafSpy.mockRestore();
  });
});
