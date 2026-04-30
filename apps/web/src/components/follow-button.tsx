'use client';

import * as React from 'react';
import { Heart, HeartOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  toggleFollowAction,
  type FollowTargetType,
} from '@/app/feed/follow-actions';

export function FollowButton({
  targetType,
  targetId,
  initiallyFollowing,
  size = 'sm',
}: {
  targetType: FollowTargetType;
  targetId: string;
  initiallyFollowing: boolean;
  size?: 'sm' | 'default';
}) {
  const [following, setFollowing] = React.useState(initiallyFollowing);
  const [pending, startTransition] = React.useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await toggleFollowAction(targetType, targetId, following);
      if (res?.error) toast.error(res.error);
      else setFollowing(res?.following ?? !following);
    });
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={pending}
      variant={following ? 'outline' : 'default'}
      size={size}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : following ? (
        <>
          <HeartOff className="h-3.5 w-3.5" />
          Unfollow
        </>
      ) : (
        <>
          <Heart className="h-3.5 w-3.5" />
          Follow
        </>
      )}
    </Button>
  );
}
