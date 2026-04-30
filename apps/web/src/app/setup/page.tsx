'use client';

import * as React from 'react';
import { ArrowRight, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FormSubmit } from '@/components/form-submit';
import { Logo } from '@/components/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { slugify } from '@/lib/slug';
import { createMyTenantAction } from './actions';

export default function SetupPage() {
  const [name, setName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);

  React.useEffect(() => {
    if (!slugTouched) setSlug(slugify(name));
  }, [name, slugTouched]);

  async function action(fd: FormData) {
    const res = await createMyTenantAction(fd);
    if (res?.error) toast.error(res.error);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="absolute inset-0 bg-radial-fade" />

      <header className="relative z-10 flex items-center justify-between p-6">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-88px)] max-w-2xl items-center px-4 pb-12">
        <Card className="w-full border-border/60 shadow-2xl shadow-primary/5">
          <CardHeader className="space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-orange-600 text-primary-foreground shadow-lg shadow-primary/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="space-y-1 text-center">
              <CardTitle className="text-2xl">Set up your league</CardTitle>
              <CardDescription>
                One last step before you can host tournaments. This becomes your public
                identity on Kabaddiadda.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form action={action} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">League / organiser name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="e.g. Bengal Premier Kabaddi"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Public URL slug</Label>
                <div className="flex overflow-hidden rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
                  <span className="flex items-center bg-muted px-3 text-sm text-muted-foreground">
                    kabaddiadda.com/t/
                  </span>
                  <input
                    id="slug"
                    name="slug"
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none"
                    placeholder="bengal-premier"
                    pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
                    minLength={2}
                    maxLength={40}
                    required
                    value={slug}
                    onChange={(e) => {
                      setSlug(e.target.value);
                      setSlugTouched(true);
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens. You can change this later.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact email (optional)</Label>
                  <Input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    placeholder="hello@yourleague.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact phone (optional)</Label>
                  <Input id="contactPhone" name="contactPhone" type="tel" placeholder="+91…" />
                </div>
              </div>
              <FormSubmit variant="flame" size="lg" className="w-full">
                Create league
                <ArrowRight className="h-4 w-4" />
              </FormSubmit>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
