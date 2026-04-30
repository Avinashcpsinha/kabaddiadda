import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 font-bold', className)}>
      <div className="relative">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-orange-600 text-primary-foreground shadow-lg shadow-primary/20">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            aria-hidden
          >
            <path
              d="M12 2L4 7v6c0 5 3.5 8.7 8 9 4.5-.3 8-4 8-9V7l-8-5z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M9 12l2 2 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
      <span className="text-lg tracking-tight">
        Kabaddi<span className="gradient-text">adda</span>
      </span>
    </div>
  );
}
