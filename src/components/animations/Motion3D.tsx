/**
 * 3D motion and effects components
 */

import { ReactNode } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import { useRef, useEffect } from 'react';
import { useMousePosition } from '@/hooks/useAnimations';

/**
 * 3D card that rotates based on mouse position
 */
export const Card3D = ({
  children,
  className = '',
  strength = 20,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mousePosition = useMousePosition();
  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);

  useEffect(() => {
    if (!ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distX = mousePosition.x - centerX;
    const distY = mousePosition.y - centerY;

    const angle = Math.atan2(distY, distX);
    const distance = Math.sqrt(distX * distX + distY * distY);
    const maxDistance = 300;

    if (distance < maxDistance) {
      const normalizedDistance = Math.min(distance / maxDistance, 1);
      rotateX.set((Math.sin(angle) * strength * normalizedDistance) / 2);
      rotateY.set((Math.cos(angle) * strength * normalizedDistance) / 2);
    }
  }, [mousePosition, rotateX, rotateY, strength]);

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{
        rotateX,
        rotateY,
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Element that rotates in 3D on scroll
 */
export const Rotate3DOnScroll = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={ref}
      className={className}
      whileInView={{
        rotateX: [0, 360],
        rotateY: [0, 180],
      }}
      transition={{
        duration: 1,
        ease: 'easeInOut',
      }}
      viewport={{ once: false, amount: 0.5 }}
      style={{
        perspective: '1200px',
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Floating 3D element
 */
export const Float3D = ({
  children,
  className = '',
  speed = 3,
  rotationSpeed = 2,
}: {
  children: ReactNode;
  className?: string;
  speed?: number;
  rotationSpeed?: number;
}) => {
  return (
    <motion.div
      className={className}
      animate={{
        y: [0, -20, 0],
        rotateX: [0, 360],
        rotateY: [0, 360],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: 'easeInOut',
        times: [0, 0.5, 1],
      }}
      style={{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Box with 3D depth effect
 */
export const Box3D = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => {
  const mousePosition = useMousePosition();
  const containerRef = useRef<HTMLDivElement>(null);

  const rotateX = useMotionValue(0);
  const rotateY = useMotionValue(0);
  const z = useMotionValue(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const distX = (mousePosition.x - centerX) / rect.width;
    const distY = (mousePosition.y - centerY) / rect.height;

    rotateY.set(distX * 30);
    rotateX.set(distY * -30);
    z.set(Math.sqrt(distX * distX + distY * distY) * 100);
  }, [mousePosition, rotateX, rotateY, z]);

  return (
    <div
      ref={containerRef}
      style={{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      <motion.div
        className={className}
        style={{
          rotateX,
          rotateY,
          z,
          transformStyle: 'preserve-3d',
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 30,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};

/**
 * Cube with 3D transformation
 */
export const Cube3D = ({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <motion.div
      className={className}
      animate={{
        rotateX: 360,
        rotateY: 360,
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        perspective: '1200px',
        transformStyle: 'preserve-3d',
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Scene with depth parallax effect
 */
export const DepthScene = ({
  foreground,
  midground,
  background,
  className = '',
}: {
  foreground?: ReactNode;
  midground?: ReactNode;
  background?: ReactNode;
  className?: string;
}) => {
  const mousePosition = useMousePosition();

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{
        perspective: '1000px',
      }}
    >
      {/* Background layer - moves less */}
      {background && (
        <motion.div
          className="absolute inset-0"
          style={{
            x: mousePosition.x * -0.02,
            y: mousePosition.y * -0.02,
            z: -100,
          }}
        >
          {background}
        </motion.div>
      )}

      {/* Midground layer - moves medium */}
      {midground && (
        <motion.div
          className="absolute inset-0"
          style={{
            x: mousePosition.x * -0.05,
            y: mousePosition.y * -0.05,
            z: 0,
          }}
        >
          {midground}
        </motion.div>
      )}

      {/* Foreground layer - moves more */}
      {foreground && (
        <motion.div
          className="absolute inset-0"
          style={{
            x: mousePosition.x * -0.1,
            y: mousePosition.y * -0.1,
            z: 100,
          }}
        >
          {foreground}
        </motion.div>
      )}
    </div>
  );
};
