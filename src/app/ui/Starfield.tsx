import { useEffect, useRef } from 'react';

interface Star {
  x: number;
  y: number;
  radius: number;
  baseAlpha: number;
  twinkleSpeed: number;
  twinklePhase: number;
  driftX: number;
  driftY: number;
  r: number;
  g: number;
  b: number;
}

const STAR_COUNT = 120;

function createStar(width: number, height: number): Star {
  const roll = Math.random();
  let r = 255;
  let g = 255;
  let b = 255;

  if (roll < 0.15) {
    // Ion Emerald
    r = 0;
    g = 255;
    b = 163;
  } else if (roll < 0.35) {
    // Pulsar Cyan
    r = 0;
    g = 210;
    b = 255;
  } else if (roll < 0.45) {
    // Solar Amber
    r = 255;
    g = 184;
    b = 0;
  }

  return {
    x: Math.random() * width,
    y: Math.random() * height,
    radius: Math.random() * 1.1 + 0.5,
    baseAlpha: Math.random() * 0.45 + 0.2,
    twinkleSpeed: Math.random() * 1.8 + 0.6,
    twinklePhase: Math.random() * Math.PI * 2,
    driftX: (Math.random() - 0.5) * 2.5,
    driftY: -(Math.random() * 5 + 3),
    r,
    g,
    b,
  };
}

/**
 * High-performance cosmic starfield canvas backdrop.
 *
 * Renders subtle drifting and twinkling stars behind all UI content.
 * Bails out completely when `prefers-reduced-motion: reduce` is active
 * and pauses immediately when the document is hidden.
 */
export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const motionQuery =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;

    if (motionQuery?.matches) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number | null = null;
    let width = 0;
    let height = 0;
    let stars: Star[] = [];

    const handleResize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (stars.length === 0) {
        stars = Array.from({ length: STAR_COUNT }, () => createStar(width, height));
      } else {
        for (const star of stars) {
          if (star.x > width) star.x = Math.random() * width;
          if (star.y > height) star.y = Math.random() * height;
        }
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    let lastTime = performance.now();

    const render = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        star.x += star.driftX * dt;
        star.y += star.driftY * dt;

        if (star.y < 0) {
          star.y = height;
          star.x = Math.random() * width;
        } else if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }

        if (star.x < 0) {
          star.x = width;
        } else if (star.x > width) {
          star.x = 0;
        }

        star.twinklePhase += star.twinkleSpeed * dt;
        const twinkle = Math.sin(star.twinklePhase) * 0.25;
        const alpha = Math.max(0.05, Math.min(1, star.baseAlpha + twinkle));

        ctx.fillStyle = `rgba(${star.r}, ${star.g}, ${star.b}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      } else {
        if (animId === null && (!motionQuery || !motionQuery.matches)) {
          lastTime = performance.now();
          animId = requestAnimationFrame(render);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const handleMotionChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        if (animId !== null) {
          cancelAnimationFrame(animId);
          animId = null;
        }
        ctx.clearRect(0, 0, width, height);
      } else if (animId === null && !document.hidden) {
        lastTime = performance.now();
        animId = requestAnimationFrame(render);
      }
    };

    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', handleMotionChange);
    }

    return () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
      }
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', handleMotionChange);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: -1,
        display: 'block',
      }}
    />
  );
}
