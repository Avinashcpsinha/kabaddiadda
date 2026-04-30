'use client';

import * as React from 'react';
import { Loader2, Plus, ShieldAlert, ShieldCheck, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { FormSubmit } from '@/components/form-submit';
import { PhotoInput } from '@/components/photo-input';
import {
  createPlayerAction,
  lookupPersonByMobileAction,
  type PersonLookupResult,
} from './actions';

export function AddPlayerForm({
  tournamentId,
  teamId,
  hasCaptain,
}: {
  tournamentId: string;
  teamId: string;
  hasCaptain: boolean;
}) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const nameRef = React.useRef<HTMLInputElement>(null);
  const [showKyc, setShowKyc] = React.useState(false);
  const [matched, setMatched] = React.useState<PersonLookupResult | null>(null);
  const [looking, setLooking] = React.useState(false);

  async function action(fd: FormData) {
    const res = await createPlayerAction(tournamentId, teamId, fd);
    if (res?.error) toast.error(res.error);
    else {
      const msg = matched ? `Added ${matched.fullName} to the team` : 'Player added';
      toast.success(msg);
      formRef.current?.reset();
      setShowKyc(false);
      setMatched(null);
    }
  }

  async function onMobileBlur(e: React.FocusEvent<HTMLInputElement>) {
    const mobile = e.target.value.trim();
    if (!mobile || !/^\+?[0-9]{10,15}$/.test(mobile)) {
      setMatched(null);
      return;
    }
    setLooking(true);
    const res = await lookupPersonByMobileAction(mobile);
    setLooking(false);
    if ('found' in res && res.found) {
      setMatched(res.person);
      if (nameRef.current && !nameRef.current.value) {
        nameRef.current.value = res.person.fullName;
      }
      toast.info(`Found existing player: ${res.person.fullName}`);
    } else {
      setMatched(null);
    }
  }

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <PhotoInput />

      <div className="space-y-2">
        <Label htmlFor="mobile" className="text-xs">
          Mobile number <span className="text-primary">· identity</span>
        </Label>
        <div className="relative">
          <Input
            id="mobile"
            name="mobile"
            type="tel"
            inputMode="tel"
            placeholder="+919876543210"
            pattern="\+?[0-9]{10,15}"
            autoComplete="off"
            onBlur={onMobileBlur}
            className={matched ? 'border-emerald-500/50 bg-emerald-500/5 pr-9' : 'pr-9'}
          />
          {looking && (
            <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {!looking && matched && (
            <UserCheck className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-500" />
          )}
        </div>
        {matched ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs">
            <div className="flex items-center gap-2">
              {matched.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={matched.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div className="h-7 w-7 rounded-full bg-emerald-500/20" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">{matched.fullName}</div>
                <div className="text-[10px] text-muted-foreground">
                  Already on Kabaddiadda · {matched.rosterCount}{' '}
                  {matched.rosterCount === 1 ? 'roster' : 'rosters'}
                  {matched.hasPan && ' · PAN ✓'}
                  {matched.hasAadhaar && ' · Aadhaar ✓'}
                </div>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">
              We&apos;ll attach this person to your team. You can override the name on this roster.
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-muted-foreground">
            One mobile = one human. We&apos;ll auto-find the person if they&apos;re already on the
            platform.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName" className="text-xs">
          Full name <Req />
        </Label>
        <Input ref={nameRef} id="fullName" name="fullName" placeholder="Pawan Sehrawat" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="jerseyNumber" className="text-xs">
            Jersey #
          </Label>
          <Input
            id="jerseyNumber"
            name="jerseyNumber"
            type="number"
            min={0}
            max={999}
            placeholder="7"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role" className="text-xs">
            Role
          </Label>
          <Select id="role" name="role" defaultValue="all_rounder">
            <option value="raider">Raider</option>
            <option value="all_rounder">All-rounder</option>
            <option value="defender_corner">Defender · Corner</option>
            <option value="defender_cover">Defender · Cover</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="heightCm" className="text-xs">
            Height (cm)
          </Label>
          <Input id="heightCm" name="heightCm" type="number" min={120} max={230} placeholder="180" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="weightKg" className="text-xs">
            Weight (kg)
          </Label>
          <Input id="weightKg" name="weightKg" type="number" min={30} max={150} placeholder="78" />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border/60 p-3 text-sm transition-colors hover:bg-accent/30">
        <input type="checkbox" name="isCaptain" className="accent-primary" />
        <span>
          Captain
          {hasCaptain && (
            <span className="ml-2 text-xs text-muted-foreground">(replaces current)</span>
          )}
        </span>
      </label>

      <details
        open={showKyc}
        onToggle={(e) => setShowKyc((e.target as HTMLDetailsElement).open)}
        className="rounded-md border border-amber-500/30 bg-amber-500/5"
      >
        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-medium">
          {matched?.hasPan && matched?.hasAadhaar ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
          )}
          KYC{' '}
          <span className="text-xs font-normal text-muted-foreground">
            {matched?.hasPan || matched?.hasAadhaar
              ? '· already on file'
              : '· optional, sensitive'}
          </span>
        </summary>
        <div className="space-y-3 px-3 pb-3">
          <p className="text-[11px] leading-snug text-muted-foreground">
            PAN and Aadhaar are stored on the <strong>person</strong>, not the roster — fill once,
            reused everywhere they play. Stored at organiser level only, never shown publicly.
          </p>
          <div className="space-y-2">
            <Label htmlFor="pan" className="text-xs">
              PAN {matched?.hasPan && <span className="text-emerald-500">· ✓ already saved</span>}
            </Label>
            <Input
              id="pan"
              name="pan"
              placeholder={matched?.hasPan ? '••••• Already on file' : 'ABCDE1234F'}
              maxLength={10}
              pattern="[A-Za-z]{5}[0-9]{4}[A-Za-z]"
              className="font-mono uppercase"
              autoComplete="off"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aadhaar" className="text-xs">
              Aadhaar number{' '}
              {matched?.hasAadhaar && <span className="text-emerald-500">· ✓ already saved</span>}
            </Label>
            <Input
              id="aadhaar"
              name="aadhaar"
              placeholder={matched?.hasAadhaar ? '•••• •••• ••••' : '1234 5678 9012'}
              inputMode="numeric"
              pattern="[0-9 ]{12,14}"
              className="font-mono"
              autoComplete="off"
            />
          </div>
        </div>
      </details>

      <FormSubmit className="w-full" variant="default">
        <Plus className="h-4 w-4" />
        Add player
      </FormSubmit>
    </form>
  );
}

function Req() {
  return <span className="text-destructive">*</span>;
}
