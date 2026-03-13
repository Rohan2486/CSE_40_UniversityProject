# Animation System Documentation

## Overview

This project includes a comprehensive animation system built with **Framer Motion**, providing smooth, professional animations across the entire application. The system includes:

- **Entrance Reveals**: Fade-in, slide-in, and scale animations
- **Hover Effects**: Interactive element feedback
- **Smooth Loaders**: Multiple loader variants with animations
- **3D Motion**: 3D transforms and perspective effects
- **Parallax Effects**: Scroll-based depth perception
- **Cursor Effects**: Custom animated cursor
- **Micro Interactions**: Small, delightful interactions

## Quick Start

### Import Animation Utilities

```tsx
import {
  useParallax,
  useMousePosition,
  useScrollReveal,
  CursorEffect,
  ParallaxContainer,
  SmoothLoader,
  EntranceReveal,
  StaggerContainer,
  AnimatedButton,
  // ... and more
} from '@/animations';

import {
  fadeInUp,
  fadeInDown,
  scaleIn,
  rotate3D,
  hoverScale,
  // ... and more
} from '@/utils/animations';
```

## Animation Components

### 1. Cursor Effects

#### CursorEffect
Custom animated cursor with glow effect:

```tsx
<CursorEffect enabled={true} glowSize={30} />
```

**Props:**
- `enabled` (boolean): Enable/disable cursor effect
- `glowSize` (number): Size of the glow radius in pixels
- `trailingEnabled` (boolean): Enable trailing particles

#### AdvancedCursor
Enhanced cursor with outer ring:

```tsx
<AdvancedCursor enabled={true} />
```

#### TracerCursor
Cursor with trailing particles:

```tsx
<TracerCursor enabled={true} />
```

### 2. Loaders

#### SmoothLoader
Smooth animated loader with rotating rings:

```tsx
<SmoothLoader size="md" message="Loading..." />
```

**Props:**
- `size`: 'sm' | 'md' | 'lg'
- `message` (optional): Loading message text

#### DotLoader
Simple bouncing dots loader:

```tsx
<DotLoader message="Processing..." />
```

#### ShimmerLoader
Skeleton/shimmer effect loader:

```tsx
<ShimmerLoader className="w-full h-48 rounded-lg" />
```

#### PageLoader
Full-page loading overlay:

```tsx
<PageLoader fullScreen={true} />
```

### 3. Parallax Effects

#### ParallaxContainer
Wrapper for parallax scrolling:

```tsx
<ParallaxContainer strength={0.5} offset={0}>
  <div>Your content here</div>
</ParallaxContainer>
```

**Props:**
- `strength` (number): Parallax intensity (0-1)
- `offset` (number): Initial offset
- `className` (string): CSS classes

#### ParallaxImage
Image with parallax effect:

```tsx
<ParallaxImage
  src="/image.jpg"
  alt="Description"
  strength={0.3}
  className="w-full h-64"
/>
```

#### ParallaxText
Text that moves with parallax:

```tsx
<ParallaxText strength={0.5}>
  <h1>Title</h1>
</ParallaxText>
```

### 4. 3D Motion Components

#### Card3D
3D card that rotates with mouse movement:

```tsx
<Card3D strength={20} className="w-64 h-48 rounded-lg">
  <div>3D Card Content</div>
</Card3D>
```

#### Float3D
Floating element with 3D rotation:

```tsx
<Float3D speed={3} rotationSpeed={2}>
  <div>Floating Content</div>
</Float3D>
```

#### Box3D
3D box responding to mouse:

```tsx
<Box3D className="w-48 h-48">
  <div>3D Box</div>
</Box3D>
```

#### DepthScene
Multi-layer scene with depth parallax:

```tsx
<DepthScene
  foreground={<div>Front</div>}
  midground={<div>Middle</div>}
  background={<div>Back</div>}
  className="w-full h-96"
/>
```

### 5. Animation Components

#### EntranceReveal
Element that reveals on scroll:

```tsx
<EntranceReveal 
  direction="up" 
  duration={0.6} 
  delay={0}
>
  <div>Content revealed on scroll</div>
</EntranceReveal>
```

**Props:**
- `direction`: 'up' | 'down' | 'left' | 'right'
- `duration` (number): Animation duration in seconds
- `delay` (number): Delay before animation starts
- `className` (string): CSS classes

#### StaggerContainer
Container that staggers child animations:

```tsx
<StaggerContainer delay={0.1}>
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</StaggerContainer>
```

**Props:**
- `delay` (number): Stagger delay between children
- `className` (string): CSS classes

#### AnimatedItem
Individual item with entrance animation:

```tsx
<AnimatedItem variant="fadeInUp">
  <div>Item Content</div>
</AnimatedItem>
```

**Variants:**
- fadeInUp
- fadeInDown
- fadeInLeft
- fadeInRight
- scaleIn

#### AnimatedButton
Button with micro interactions:

```tsx
<AnimatedButton onClick={handleClick}>
  Click Me
</AnimatedButton>
```

#### PulseBadge
Animated badge with pulse effect:

```tsx
<PulseBadge variant="success">
  Active
</PulseBadge>
```

**Variants:**
- default
- success
- warning
- error

#### SuccessCheckmark
Animated success checkmark:

```tsx
<SuccessCheckmark className="w-12 h-12" />
```

#### TextReveal
Character-by-character text reveal:

```tsx
<TextReveal text="Hello world" delay={0.05} />
```

#### AnimatedCounter
Animates number changes:

```tsx
<AnimatedCounter from={0} to={100} duration={2} />
```

### 6. Custom Hooks

#### useParallax
For scroll-based parallax:

```tsx
const { ref, y } = useParallax(0.5);

return (
  <motion.div ref={ref} style={{ y }}>
    Content
  </motion.div>
);
```

#### useMousePosition
Track mouse position:

```tsx
const mousePosition = useMousePosition();

// Use: mousePosition.x, mousePosition.y
```

#### useScrollReveal
Detect when element enters viewport:

```tsx
const { ref, isVisible } = useScrollReveal();

return (
  <div ref={ref}>
    {isVisible && <YourComponent />}
  </div>
);
```

#### useInViewport
Check if element is in viewport:

```tsx
const { ref, isInViewport } = useInViewport();

return (
  <div ref={ref}>
    {isInViewport && <ActiveComponent />}
  </div>
);
```

#### useElemOnScreen
Trigger animation when visible:

```tsx
const { ref, isVisible } = useElemOnScreen();

return (
  <motion.div
    ref={ref}
    animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
  >
    Content
  </motion.div>
);
```

## Animation Variants

Pre-defined animation variants for common patterns:

### Entrance Animations
- `fadeInUp`: Fade in while moving up
- `fadeInDown`: Fade in while moving down
- `fadeInLeft`: Fade in while moving from left
- `fadeInRight`: Fade in while moving from right
- `scaleIn`: Scale up entrance
- `scaleInBouncy`: Bouncy scale entrance

### 3D Animations
- `rotate3D`: 3D rotation entrance
- `perspective3D`: Perspective entrance

### Hover Animations
- `hoverScale`: Scale on hover
- `hoverGlow`: Glow effect on hover
- `hoverLift`: Lift effect on hover

### Motion Animations
- `shimmer`: Shimmer effect
- `pulse`: Pulsing animation
- `bounce`: Bouncing animation
- `rotate`: Continuous rotation

### Slide Animations
- `slideInFromLeft`: Slide in from left
- `slideInFromRight`: Slide in from right

## Usage Examples

### Example 1: Page with Multiple Animations

```tsx
import { 
  CursorEffect, 
  EntranceReveal, 
  StaggerContainer, 
  ParallaxContainer,
  SmoothLoader 
} from '@/animations';
import { motion } from 'framer-motion';

export default function AnimatedPage() {
  return (
    <div className="min-h-screen overflow-hidden">
      {/* Custom cursor */}
      <CursorEffect enabled={true} />

      {/* Parallax background */}
      <ParallaxContainer strength={0.3}>
        <div className="fixed inset-0 bg-gradient-to-br from-blue-500/10 to-purple-500/10" />
      </ParallaxContainer>

      {/* Page content */}
      <main className="relative z-10">
        {/* Title with entrance animation */}
        <EntranceReveal direction="down" duration={0.8}>
          <h1 className="text-5xl font-bold">Welcome</h1>
        </EntranceReveal>

        {/* Staggered list */}
        <StaggerContainer delay={0.1}>
          {['Item 1', 'Item 2', 'Item 3'].map((item) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {item}
            </motion.div>
          ))}
        </StaggerContainer>
      </main>
    </div>
  );
}
```

### Example 2: Interactive 3D Card

```tsx
import { Card3D, MousePosition } from '@/animations';

export default function InteractiveCard() {
  return (
    <Card3D strength={20} className="w-full max-w-sm">
      <div className="p-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
        <h2 className="text-2xl font-bold mb-4">Interactive Card</h2>
        <p>Move your mouse to see the 3D effect!</p>
      </div>
    </Card3D>
  );
}
```

### Example 3: Loader States

```tsx
import { SmoothLoader, DotLoader, ShimmerLoader } from '@/animations';
import { useState } from 'react';

export default function LoaderDemo() {
  const [loading, setLoading] = useState(true);

  return (
    <div className="space-y-8">
      {/* Smooth loader */}
      <div className="flex justify-center">
        <SmoothLoader size="lg" message="Processing..." />
      </div>

      {/* Dot loader */}
      <div className="flex justify-center">
        <DotLoader message="Loading data..." />
      </div>

      {/* Shimmer loader */}
      <ShimmerLoader className="w-full h-48 rounded-lg" />
    </div>
  );
}
```

## Performance Tips

1. **Use `initial={{ ... }}` with `whileInView`**: Reduces initial render cost
2. **Lazy load animations**: Only animate visible elements
3. **Limit particle effects**: Keep cursor trails short
4. **Use `will-change` CSS**: For frequently animated elements
5. **Debounce expensive hooks**: Use `useThrottledMousePosition` instead of `useMousePosition`

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14.1+
- Edge 90+

## Tailwind CSS Integration

The animation system works seamlessly with Tailwind CSS. Animations are applied via Framer Motion, so no special Tailwind configuration is needed.

## Common Patterns

### Fade In On Scroll
```tsx
<motion.div
  initial={{ opacity: 0 }}
  whileInView={{ opacity: 1 }}
  transition={{ duration: 0.6 }}
  viewport={{ once: true }}
>
  Content
</motion.div>
```

### Staggered List
```tsx
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: {
      transition: { staggerChildren: 0.1 }
    }
  }}
>
  {items.map(item => (
    <motion.li
      key={item.id}
      variants={fadeInUp}
    >
      {item.name}
    </motion.li>
  ))}
</motion.ul>
```

### Hover Effects
```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
>
  Click Me
</motion.button>
```

## Troubleshooting

### Animations not playing
- Check if `initial` is set correctly
- Verify `viewport={{ once: true }}` isn't preventing re-renders
- Ensure `whileInView` observer has mounted

### Performance issues
- Reduce number of simultaneous animations
- Use `will-change` CSS property
- Debounce scroll listeners
- Profile with Chrome DevTools

### 3D effects not showing
- Check if parent has `perspective` CSS property
- Verify `transformStyle: 'preserve-3d'` is set
- Ensure browser supports 3D transforms

## Resources

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Web Animations API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API)

## Contributing

When adding new animations:

1. Create component in appropriate folder
2. Export from barrel file (`index.ts`)
3. Add to this documentation
4. Test performance
5. Ensure accessibility (respect `prefers-reduced-motion`)

---

**Last Updated**: March 8, 2026  
**Version**: 1.0.0
