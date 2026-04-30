import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';

export function StatCard({
  label,
  value,
  delta,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon: LucideIcon;
  tone?: 'default' | 'positive' | 'negative';
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-muted-foreground">{label}</div>
            <div className="mt-2 text-3xl font-bold tracking-tight">{value}</div>
            {delta && (
              <div
                className={cn(
                  'mt-1 text-xs font-medium',
                  tone === 'positive'
                    ? 'text-emerald-500'
                    : tone === 'negative'
                      ? 'text-red-500'
                      : 'text-muted-foreground',
                )}
              >
                {delta}
              </div>
            )}
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
