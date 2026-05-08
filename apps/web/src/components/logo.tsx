import Image from 'next/image';
import { cn } from '@/lib/utils';

// Kabaddi Adda brand mark. Icon-only PNGs paired with a code-rendered
// wordmark so the text adapts to light/dark themes. Two source assets:
//   header: /public/Logo.png         (465×337, icon-only)
//   footer: /public/Logo_footer.png  (465×337, icon-only)
// Each variant carries its own default sizing so call sites don't need to
// know the asset's aspect ratio. Pass `iconOnly` to hide the wordmark.
const VARIANTS = {
  header: {
    src: '/Logo.png',
    width: 465,
    height: 337,
    iconClass: 'h-10 w-auto',
    textClass: 'text-xl',
  },
  footer: {
    src: '/Logo_footer.png',
    width: 465,
    height: 337,
    iconClass: 'h-14 w-auto',
    textClass: 'text-2xl',
  },
} as const;

export function Logo({
  className,
  priority = false,
  variant = 'header',
  iconOnly = false,
}: {
  className?: string;
  priority?: boolean;
  variant?: keyof typeof VARIANTS;
  iconOnly?: boolean;
}) {
  const { src, width, height, iconClass, textClass } = VARIANTS[variant];
  const icon = (
    <Image
      src={src}
      alt="Kabaddi Adda"
      width={width}
      height={height}
      priority={priority}
      className={cn(iconClass, className)}
    />
  );
  if (iconOnly) return icon;
  return (
    <span className="inline-flex items-center gap-3">
      {icon}
      <span
        className={cn(
          'font-display uppercase tracking-wide text-foreground',
          textClass,
        )}
      >
        Kabaddi Adda
      </span>
    </span>
  );
}
