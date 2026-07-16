import React, { useEffect, useRef } from 'react';

const CatCursor: React.FC = () => {
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number>(0);
  const targetRef = useRef({ x: -100, y: -100 });
  const hoveringRef = useRef(false);
  const visibleRef = useRef(false);

  useEffect(() => {
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cursor = cursorRef.current;
    const glow = glowRef.current;
    if (!cursor || !glow) return;

    const updatePosition = () => {
      const { x, y } = targetRef.current;
      const hover = hoveringRef.current;
      const vis = visibleRef.current;
      const size = hover ? 36 : 24;
      const glowSize = hover ? 220 : 140;

      cursor.style.opacity = vis ? '1' : '0';
      glow.style.opacity = vis ? '1' : '0';

      cursor.style.transform = `translate3d(${x - size / 2}px, ${y - size / 4}px, 0) scale(${hover ? 1.25 : 1})`;
      cursor.style.width = `${size}px`;
      cursor.style.height = `${size}px`;

      glow.style.transform = `translate3d(${x - glowSize / 2}px, ${y - glowSize / 4}px, 0)`;
      glow.style.width = `${glowSize}px`;
      glow.style.height = `${glowSize}px`;

      rafRef.current = requestAnimationFrame(updatePosition);
    };

    const handleMove = (e: MouseEvent) => {
      targetRef.current = { x: e.clientX, y: e.clientY };
      visibleRef.current = true;
      const target = e.target as HTMLElement;
      hoveringRef.current = !!target.closest(
        'a, button, [role="button"], input, textarea, select, [data-cursor="pointer"]'
      );
    };
    const handleLeave = () => {
      visibleRef.current = false;
    };

    rafRef.current = requestAnimationFrame(updatePosition);
    window.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
    };
  }, []);

  return (
    <>
      {/* 多彩背景光晕 */}
      <div
        ref={glowRef}
        className="pointer-events-none fixed z-[9997] rounded-full opacity-0 will-change-transform"
        style={{
          background: 'radial-gradient(circle, hsla(175,60%,70%,0.22) 0%, hsla(30,85%,70%,0.16) 40%, transparent 70%)',
          filter: 'blur(36px)',
          transition: 'width 0.25s ease-out, height 0.25s ease-out',
        }}
      />
      {/* 猫咪光标 */}
      <div
        ref={cursorRef}
        className="pointer-events-none fixed z-[9999] opacity-0 will-change-transform"
        style={{ transition: 'width 0.2s ease-out, height 0.2s ease-out' }}
      >
        <svg viewBox="0 0 1042 1024" className="h-full w-full drop-shadow-lg" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.96 984.08h34.93a19.96 19.96 0 1 1 0 39.92H19.96a19.96 19.96 0 0 1 0-39.92zm920.65 0h82.33a19.96 19.96 0 0 1 0 39.92h-82.33a19.96 19.96 0 0 1 0-39.92zm-798.4 0h721.05a19.96 19.96 0 0 1 0 39.92H142.21a19.96 19.96 0 0 1 0-39.92z" fill="#261D50" />
          <path d="M378.11 87.94l17.38-9.6h64.87v284.2l40.48 94.32h40.79l40.53-94.32V78.34h64.87l79.35 43.79a76.1 76.1 0 0 1 38.35 65.98l0.6 66.49 60.27 75.3v252.14l-111.9 223.57a220.6 220.6 0 0 1-198.35 122.46 223.16 223.16 0 0 1-189.22-106.04L282.7 643.67V483.66l60.27-121.6 0.56-173.94m14.25-44.23a75.88 75.88 0 0 1 24.1-21.76l16.64-9.18" fill="#FFFFFF" />
          <path d="M448.46 78.34h152.17v385.69H448.46z" fill="#FFFFFF" />
          <path d="M524.78 146.64a29.94 29.94 0 0 1 29.94 29.94v123.43a29.94 29.94 0 0 1-59.88 0V176.58a29.94 29.94 0 0 1 29.94-29.94z" fill="#FF6660" />
          <path d="M523.23 721.3V456.83h19.46l40.46-94.32V76.84h64.87l79.35 45.3a76.1 76.1 0 0 1 38.35 65.98l0.6 66.49-0.6 277.46C727.95 607.61 607.75 721.3 523.23 721.3z" fill="#72C69C" />
          <path d="M522.29 722.96c-76.7 0-203.47-117.27-243.48-182.71l-0.6-178.2 0.6-173.93a76.1 76.1 0 0 1 38.35-65.98l79.34-45.3h64.87v285.68l40.48 94.32h21.34c0.04 115.02-0.91 211.2-0.91 266.12z" fill="#00B7D6" />
          <path d="M266.16 360.07h24.1v381.17h-24.1z" fill="#1E2148" />
          <path d="M754.3 257.63h24.1v444.44h-24.1z" fill="#20224A" />
          <path d="M510.23 462.53h24.1v259.14h-24.1z" fill="#22234C" />
          <path d="M520.25 733.71c-41.6 0-84.16-16.35-126.45-48.65-41.18-31.38-83.44-68.87-125.57-131.16l19.96-13.5c80.41 118.93 158.43 179.22 232.03 179.22s154.18-61.13 239.27-181.72l19.77 13.9c-44.47 63-88.48 111.02-130.82 142.8-43.51 32.6-86.63 49.11-128.2 49.11z" fill="#261D50" />
          <path d="M443.94 78.34V42.17a30.13 30.13 0 0 1 30.13-30.13h96.42a30.13 30.13 0 0 1 30.13 30.13v36.17z" fill="#FDD838" />
          <path d="M612.68 90.4H431.9V42.2A42.23 42.23 0 0 1 474.07 0h96.42a42.23 42.23 0 0 1 42.19 42.2zm-156.69-24.1h132.58V42.2a18.1 18.1 0 0 0-18.07-18.08h-96.43a18.1 18.1 0 0 0-18.08 18.08z" fill="#261D50" />
          <path d="M522.1 342c-20.77 0-37.66-18.84-37.66-42V176.58c0-23.15 16.9-42 37.66-42s37.61 18.85 37.61 42V300c0 23.1-16.84 42-37.61 42zm0-183.3c-7.35 0-13.56 8.2-13.56 17.89V300c0 9.7 6.24 17.89 13.56 17.89s13.56-8.2 13.56-17.89V176.58c0-9.7-6.21-17.89-13.56-17.89z" fill="#261F4F" />
        </svg>
      </div>
    </>
  );
};

export default CatCursor;