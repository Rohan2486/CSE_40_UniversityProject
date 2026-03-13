/**
 * Micro interactions and entrance reveal components
 */

import { ReactNode, useState, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  fadeInUp,
  fadeInDown,
  fadeInLeft,
  fadeInRight,
  scaleIn,
  scaleInBouncy,
  rotate3D,
  containerVariants,
  itemVariants,
} from '@/utils/animations';

/**
 * Staggered container for list animations
 */
export const StaggerContainer = ({
  children,
  className = '',
  delay = 0.1,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) => {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.3 }}
      variants={{
        hidden: { opacity: 0 },
        visible: {
          opacity: 1,
          transition: {
            staggerChildren: delay,
            delayChildren: 0.2,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Animated list item
 */
export const AnimatedItem = ({
  children,
  variant = 'fadeInUp',
  className = '',
}: {
  children: ReactNode;
  variant?: 'fadeInUp' | 'fadeInDown' | 'fadeInLeft' | 'fadeInRight' | 'scaleIn';
  className?: string;
}) => {
  const variantsMap: Record<string, any> = {
    fadeInUp,
    fadeInDown,
    fadeInLeft,
    fadeInRight,
    scaleIn,
  };

  return (
    <motion.div
      className={className}
      variants={variantsMap[variant]}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Entrance reveal wrapper
 */
export const EntranceReveal = ({
  children,
  direction = 'up',
  duration = 0.6,
  delay = 0,
  className = '',
}: {
  children: ReactNode;
  direction?: 'up' | 'down' | 'left' | 'right';
  duration?: number;
  delay?: number;
  className?: string;
}) => {
  const initialValues = {
    up: { opacity: 0, y: 30 },
    down: { opacity: 0, y: -30 },
    left: { opacity: 0, x: -30 },
    right: { opacity: 0, x: 30 },
  };

  return (
    <motion.div
      className={className}
      initial={initialValues[direction]}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      viewport={{ once: true, amount: 0.3 }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Hover scale button animation
 */
export const AnimatedButton = ({
  children,
  className = '',
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  return (
    <motion.button
      className={className}
      onClick={onClick}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.05 }}
      whileTap={disabled ? {} : { scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 17,
      }}
    >
      {children}
    </motion.button>
  );
};

/**
 * Expandable section with animation
 */
export const ExpandableSection = ({
  title,
  children,
  defaultOpen = false,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);

  return (
    <motion.div>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 px-4 rounded-lg hover:bg-secondary/50 transition-colors"
        whileHover={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
      >
        {title}
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3 }}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Animated badge with pulse
 */
export const PulseBadge = ({
  children,
  className = '',
  variant = 'default',
}: {
  children: ReactNode;
  className?: string;
  variant?: 'default' | 'success' | 'warning' | 'error';
}) => {
  const variants = {
    default: 'bg-primary/20 text-primary',
    success: 'bg-green-500/20 text-green-700',
    warning: 'bg-yellow-500/20 text-yellow-700',
    error: 'bg-red-500/20 text-red-700',
  };

  return (
    <motion.div
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
        variants[variant]
      } ${className}`}
      animate={{
        boxShadow: [
          '0 0 0 0 rgba(139, 92, 246, 0.7)',
          '0 0 0 10px rgba(139, 92, 246, 0)',
        ],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
      }}
    >
      {children}
    </motion.div>
  );
};

/**
 * Animated text reveal - character by character
 */
export const TextReveal = ({
  text,
  delay = 0.05,
  className = '',
}: {
  text: string;
  delay?: number;
  className?: string;
}) => {
  const characters = Array.from(text);

  return (
    <motion.div className={className}>
      {characters.map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            delay: index * delay,
          }}
          viewport={{ once: true }}
        >
          {char}
        </motion.span>
      ))}
    </motion.div>
  );
};

/**
 * Counter animation
 */
export const AnimatedCounter = ({
  from = 0,
  to = 100,
  duration = 2,
  className = '',
}: {
  from?: number;
  to: number;
  duration?: number;
  className?: string;
}) => {
  const count = useMotionValue(from);
  const rounded = useTransform(count, (latest) =>
    Math.round(latest)
  );

  useEffect(() => {
    const controls = count.set(to);
    
    // Animate the count value
    const animation = setInterval(() => {
      const current = count.get();
      if (current < to) {
        const increment = (to - from) / (duration * 60);
        count.set(current + increment);
      } else {
        count.set(to);
      }
    }, 1000 / 60); // 60fps

    return () => clearInterval(animation);
  }, [count, from, to, duration]);

  return (
    <motion.span className={className}>
      {rounded}
    </motion.span>
  );
};

/**
 * Success checkmark animation
 */
export const SuccessCheckmark = ({ className = '' }: { className?: string }) => {
  return (
    <motion.svg
      className={`w-12 h-12 text-green-500 ${className}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      initial={{ scale: 0, rotate: -180 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{
        type: 'spring',
        stiffness: 200,
        damping: 20,
      }}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </motion.svg>
  );
};

/**
 * Shimmer text effect
 */
export const ShimmerText = ({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) => {
  return (
    <motion.div
      className={`bg-gradient-to-r from-transparent via-white to-transparent bg-200% text-transparent bg-clip-text ${className}`}
      animate={{
        backgroundPosition: ['0% 0%', '200% 0%'],
      }}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {text}
    </motion.div>
  );
};
