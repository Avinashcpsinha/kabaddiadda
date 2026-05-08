'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { subscribeAction, cancelSubscriptionAction, changePlanAction } from './actions';
import type { PlanId } from '@/lib/billing';

/**
 * Subscribe to a paid plan. Calls the server action, then navigates the
 * browser to the provider-hosted checkout. After the user completes (or
 * abandons) checkout the provider redirects them back to /organiser/billing
 * with `?subscribed=1` or `?cancelled=1` so we can show a toast.
 */
export function SubscribeButton({ plan }: { plan: 'pro' }) {
  const [pending, startTransition] = React.useTransition();
  return (
    <Button
      variant="flame"
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await subscribeAction({ plan });
          if (res?.error) toast.error(res.error);
          else if (res?.checkoutUrl) window.location.href = res.checkoutUrl;
        })
      }
    >
      {pending ? 'Starting checkout…' : `Upgrade to ${plan === 'pro' ? 'Pro' : plan}`}
    </Button>
  );
}

/**
 * Cancel the active subscription. Defaults to "at period end" so the
 * customer doesn't lose access mid-cycle. Confirms before firing.
 */
export function CancelButton() {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (
          !confirm(
            'Cancel your subscription? You keep Pro features until the next renewal date, then drop to Free.',
          )
        )
          return;
        startTransition(async () => {
          const res = await cancelSubscriptionAction({ atPeriodEnd: true });
          if (res?.error) toast.error(res.error);
          else {
            toast.success('Subscription will end on the next renewal date.');
            router.refresh();
          }
        });
      }}
    >
      {pending ? 'Cancelling…' : 'Cancel subscription'}
    </Button>
  );
}

export function ChangePlanButton({ plan, label }: { plan: PlanId; label: string }) {
  const [pending, startTransition] = React.useTransition();
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const res = await changePlanAction({ plan });
          if (res?.error) toast.error(res.error);
          else {
            toast.success('Plan change scheduled — takes effect at next renewal.');
            router.refresh();
          }
        });
      }}
    >
      {pending ? 'Switching…' : label}
    </Button>
  );
}
