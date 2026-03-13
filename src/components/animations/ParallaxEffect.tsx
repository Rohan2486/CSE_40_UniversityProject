/**
 * Parallax effect components
 */

import { ReactNode } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef } from 'react';

interface ParallaxProps {
  children: ReactNode;
  offset?: number;
  strength?: number;
  className?: string;
}

/**
 * Simple parallax wrapper using scroll
 */
export const ParallaxContainer = ({
  children,
  offset = 0,
  strength = 0.5,
  className = '',
}: ParallaxProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const distance = Math.max(24, Math.min(180, 120 * strength));
  const y = useTransform(scrollYProgress, [0, 1], [-distance + offset, distance + offset]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Parallax image effect
 */
export const ParallaxImage = ({
  src,
  alt,
  strength = 0.3,
  className = '',
}: {
  src: string;
  alt: string;
  strength?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const distance = Math.max(30, Math.min(200, 140 * strength));
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.img
        src={src}
        alt={alt}
        style={{
          y,
        }}
        className="w-full h-full object-cover"
      />
    </div>
  );
};

/**
 * Text parallax effect
 */
export const ParallaxText = ({
  children,
  strength = 0.5,
  className = '',
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });
  const distance = Math.max(18, Math.min(90, 75 * strength));
  const y = useTransform(scrollYProgress, [0, 1], [-distance, distance]);

  return (
    <motion.div
      ref={ref}
      style={{ y }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

/**
 * Multi-layer parallax effect
 */
export const MultiLayerParallax = ({
  layers,
  className = '',
}: {
  layers: {
    children: ReactNode;
    offset?: number;
    strength?: number;
  }[];
  className?: string;
}) => {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {layers.map((layer, index) => (
        <ParallaxContainer
          key={index}
          strength={layer.strength || 0.3 + index * 0.2}
          offset={layer.offset || 0}
          className="absolute inset-0"
        >
          {layer.children}
        </ParallaxContainer>
      ))}
    </div>
  );
};

/**
 * Scroll-based parallax with perspective
 */
export const PerspectiveParallax = ({
  children,
  strength = 0.5,
  className = '',
}: ParallaxProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });

  const y = useTransform(
    scrollY,
    (latest) => latest * strength * -1
  );

  const rotateX = useTransform(
    scrollY,
    [0, 1000],
    [0, 15]
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ perspective: '1200px' }}
    >
      <motion.div
        style={{
          y,
          rotateX,
        }}
      >
        {children}
      </motion.div>
    </div>
  );
};
