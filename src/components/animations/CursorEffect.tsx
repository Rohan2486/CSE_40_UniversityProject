/**
 * Custom cursor effect component with glow and trailing
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, useSpring } from 'framer-motion';
import { useMousePosition } from '@/hooks/useAnimations';

interface CursorEffectProps {
  enabled?: boolean;
  glowSize?: number;
  trailingEnabled?: boolean;
}

export const CursorEffect = ({
  enabled = true,
  glowSize = 30,
  trailingEnabled = true,
}: CursorEffectProps) => {
  const mousePosition = useMousePosition();
  const [isInteractive, setIsInteractive] = useState(false);
  const [isCursorAllowed, setIsCursorAllowed] = useState(false);

  const springX = useSpring(mousePosition.x, { stiffness: 180, damping: 24 });
  const springY = useSpring(mousePosition.y, { stiffness: 180, damping: 24 });
  const leadX = useSpring(mousePosition.x, { stiffness: 340, damping: 28 });
  const leadY = useSpring(mousePosition.y, { stiffness: 340, damping: 28 });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setIsCursorAllowed(false);
      return;
    }

    const finePointer = window.matchMedia('(pointer: fine)');
    const anyFinePointer = window.matchMedia('(any-pointer: fine)');
    const updateState = () => {
      // Prefer showing cursor on desktop-class devices; mouse movement listener below is the final fallback.
      setIsCursorAllowed(finePointer.matches || anyFinePointer.matches || window.innerWidth >= 1024);
    };

    const subscribe = (query: MediaQueryList) => {
      if (typeof query.addEventListener === 'function') {
        query.addEventListener('change', updateState);
        return () => query.removeEventListener('change', updateState);
      }
      query.addListener(updateState);
      return () => query.removeListener(updateState);
    };

    updateState();
    const unsubFine = subscribe(finePointer);
    const unsubAnyFine = subscribe(anyFinePointer);
    const handleMouseMove = () => {
      setIsCursorAllowed(true);
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    return () => {
      unsubFine();
      unsubAnyFine();
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [enabled]);

  useEffect(() => {
    if (!isCursorAllowed) return undefined;
    const bodyClass = 'cursor-none-enabled';
    document.body.classList.add(bodyClass);
    return () => {
      document.body.classList.remove(bodyClass);
    };
  }, [isCursorAllowed]);

  useEffect(() => {
    if (!isCursorAllowed) return undefined;

    const updateInteractiveState = (target: EventTarget | null) => {
      const node = target as HTMLElement | null;
      setIsInteractive(
        !!node?.closest('a, button, input, textarea, select, [role="button"]')
      );
    };

    const handlePointerMove = (event: PointerEvent) => updateInteractiveState(event.target);
    const handleMouseMove = (event: MouseEvent) => updateInteractiveState(event.target);

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [isCursorAllowed]);

  const glowGradient = useMemo(
    () =>
      'radial-gradient(circle, hsl(var(--accent) / 0.55) 0%, hsl(var(--primary) / 0.35) 60%, transparent 100%)',
    []
  );

  if (!enabled || !isCursorAllowed) return null;

  return (
    <>
      <motion.div
        className="pointer-events-none fixed z-[60] rounded-full mix-blend-screen"
        style={{
          width: glowSize,
          height: glowSize,
          background: glowGradient,
          left: leadX,
          top: leadY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isInteractive ? 1.45 : 1,
          opacity: isInteractive ? 0.95 : 0.7,
        }}
        transition={{
          type: 'spring',
          stiffness: 320,
          damping: 24,
        }}
      />

      <motion.div
        className="pointer-events-none fixed z-[61] h-2.5 w-2.5 rounded-full border border-accent bg-primary"
        style={{
          left: springX,
          top: springY,
          translateX: '-50%',
          translateY: '-50%',
        }}
        animate={{
          scale: isInteractive ? 0.75 : 1,
        }}
        transition={{
          type: 'spring',
          stiffness: 340,
          damping: 26,
        }}
      />

      {trailingEnabled && (
        <motion.div
          className="pointer-events-none fixed z-[59] h-14 w-14 rounded-full border border-accent/40"
          style={{
            left: springX,
            top: springY,
            translateX: '-50%',
            translateY: '-50%',
          }}
          animate={{
            scale: isInteractive ? 1.15 : 1,
            opacity: isInteractive ? 0.85 : 0.45,
          }}
          transition={{ duration: 0.2 }}
        />
      )}
    </>
  );
};

/**
 * Enhanced cursor with pointer animation
 */
export const AdvancedCursor = ({
  enabled = true,
}: {
  enabled?: boolean;
}) => {
  return <CursorEffect enabled={enabled} glowSize={36} trailingEnabled />;
};

/**
 * Simple cursor tracer
 */
export const TracerCursor = ({
  enabled = true,
}: {
  enabled?: boolean;
}) => {
  return <CursorEffect enabled={enabled} glowSize={28} trailingEnabled />;
};
