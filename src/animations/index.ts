/**
 * Animation components and hooks barrel export
 * Convenience imports for all animation-related utilities
 */

// Animation variants
export * from '@/utils/animations';

// Animation hooks
export {
  useParallax,
  useMousePosition,
  useScrollReveal,
  useInViewport,
  useThrottledMousePosition,
  useElemOnScreen,
} from '@/hooks/useAnimations';

// Loader components
export {
  SmoothLoader,
  DotLoader,
  InlineLoader,
  ShimmerLoader,
  PageLoader,
} from '@/components/animations/SmoothLoader';

// Cursor effect components
export {
  CursorEffect,
  AdvancedCursor,
  TracerCursor,
} from '@/components/animations/CursorEffect';

// Parallax components
export {
  ParallaxContainer,
  ParallaxImage,
  ParallaxText,
  MultiLayerParallax,
  PerspectiveParallax,
} from '@/components/animations/ParallaxEffect';

// 3D motion components
export {
  Card3D,
  Rotate3DOnScroll,
  Float3D,
  Box3D,
  Cube3D,
  DepthScene,
} from '@/components/animations/Motion3D';

// Animation components
export {
  StaggerContainer,
  AnimatedItem,
  EntranceReveal,
  AnimatedButton,
  ExpandableSection,
  PulseBadge,
  TextReveal,
  AnimatedCounter,
  SuccessCheckmark,
  ShimmerText,
} from '@/components/animations/AnimationComponents';
