import { Activity, Building2, IndianRupee, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCard } from '@/components/dashboard/stat-card';

export default function AdminHome() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Platform overview</h1>
        <p className="mt-1 text-muted-foreground">Health of the entire Kabaddiadda platform.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active tenants" value="38" icon={Building2} delta="+4 this month" tone="positive" />
        <StatCard label="Total users" value="14,201" icon={Users} delta="+1,204 this week" tone="positive" />
        <StatCard label="Live matches" value="7" icon={Activity} delta="across 5 tenants" />
        <StatCard
          label="Platform GMV"
          value="₹18.4L"
          icon={IndianRupee}
          delta="+18% vs last month"
          tone="positive"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent tenant signups</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: 'Bengal Pro Kabaddi', plan: 'Pro', status: 'active', since: '2d ago' },
                { name: 'Maharashtra Open', plan: 'Free', status: 'pending KYC', since: '4d ago' },
                { name: 'Punjab District League', plan: 'Pro', status: 'active', since: '1w ago' },
              ].map((t) => (
                <div
                  key={t.name}
                  className="flex items-center justify-between rounded-lg border border-border/50 p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-amber-500/20 to-amber-500/0 text-amber-500 ring-1 ring-amber-500/20">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-medium">{t.name}</div>
                      <div className="text-xs text-muted-foreground">Joined {t.since}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{t.plan}</Badge>
                    <Badge variant={t.status === 'active' ? 'success' : 'secondary'}>
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System health</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <HealthLine label="API latency p95" value="142 ms" ok />
            <HealthLine label="Realtime channels" value="48 active" ok />
            <HealthLine label="DB connections" value="22 / 100" ok />
            <HealthLine label="Background jobs" value="0 stuck" ok />
            <HealthLine label="Last incident" value="14d ago" ok />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HealthLine({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-red-500'} shadow-[0_0_8px] ${
            ok ? 'shadow-emerald-500/50' : 'shadow-red-500/50'
          }`}
        />
        {label}
      </span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
