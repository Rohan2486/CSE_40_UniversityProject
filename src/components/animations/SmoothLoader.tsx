/**
 * Smooth animated loader component
 */

import { motion } from 'framer-motion';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export const SmoothLoader = ({ size = 'md', message }: LoaderProps) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="relative">
        {/* Outer rotating ring */}
        <motion.div
          className={`${sizeClasses[size]} rounded-full border-2 border-transparent border-t-primary border-r-primary/50`}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />

        {/* Inner pulsing ring */}
        <motion.div
          className={`${sizeClasses[size]} absolute inset-0 rounded-full border border-primary/30`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />

        {/* Center dot */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ scale: [1, 0.8, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
        </motion.div>
      </div>

      {message && (
        <motion.p
          className="text-sm text-muted-foreground text-center"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {message}
        </motion.p>
      )}
    </div>
  );
};

/**
 * Simple dot loader
 */
export const DotLoader = ({ message }: { message?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-primary"
            animate={{
              y: [0, -8, 0],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.1,
            }}
          />
        ))}
      </div>
      {message && (
        <p className="text-xs text-muted-foreground">{message}</p>
      )}
    </div>
  );
};

export const InlineLoader = ({ className = '' }: { className?: string }) => {
  return (
    <motion.span
      className={`inline-block h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary ${className}`}
      animate={{ rotate: 360 }}
      transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
    />
  );
};

/**
 * Shimmer/skeleton loader
 */
export const ShimmerLoader = ({ className = '' }: { className?: string }) => {
  return (
    <motion.div
      className={`relative overflow-hidden rounded-lg bg-gradient-to-r from-muted via-muted-foreground/20 to-muted ${className}`}
      animate={{
        backgroundPosition: ['0% 0%', '100% 100%'],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
        ease: 'linear',
      }}
      style={{
        backgroundSize: '200% 200%',
      }}
    />
  );
};

/**
 * Page loading overlay
 */
export const PageLoader = ({ fullScreen = true }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={`flex items-center justify-center ${
        fullScreen ? 'fixed inset-0' : 'min-h-screen'
      } bg-background/60`}
    >
      <SmoothLoader size="lg" />
    </motion.div>
  );
};
