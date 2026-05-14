import Link from 'next/link';
import { Activity, Globe, Heart, Sparkles, Trophy, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'About — building the home of Kabaddi',
  description:
    'Kabaddiadda is the platform for everything kabaddi: tournaments, teams, players, and fans. Built by people who love the sport, for the people who run it.',
};

export default function AboutPage() {
  return (
    <div className="space-y-20 py-16 md:py-24">
      {/* HERO -------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            About
          </Badge>
          <h1 className="text-balance font-display text-5xl uppercase leading-none tracking-tight md:text-7xl">
            The home of <span className="text-primary">Kabaddi.</span>
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            Kabaddiadda is the platform built for the people who run kabaddi — local
            organisers, district federations, college tournaments — and for the fans who
            follow them. One place for tournaments, teams, live scoring, and the stats
            that match the broadcast.
          </p>
        </div>
      </section>

      {/* MISSION ----------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl space-y-6 text-lg leading-relaxed">
          <h2 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
            Why we built this
          </h2>
          <p className="text-muted-foreground">
            Kabaddi has a real fan culture and serious tournaments at every level — from
            mat-side district leagues to the Pro Kabaddi League. But running a tournament
            still means stitching together spreadsheets, WhatsApp groups, and paper
            scoresheets. Stats end up in someone's notebook. Fans follow scores by
            screenshot.
          </p>
          <p className="text-muted-foreground">
            We started Kabaddiadda because the sport deserves better tools. Tap-driven
            live scoring built for the operator. Public match pages that fans can share.
            Reports that match the broadcast. Branding for serious leagues, free
            forever for the hobbyist running their first knock-out.
          </p>
          <p className="text-muted-foreground">
            One league. Multiple tournaments. Real-time stats. We're building it in the
            open, shipping fast, and listening to organisers every week.
          </p>
        </div>
      </section>

      {/* VALUES ------------------------------------------------------ */}
      <section className="container mx-auto px-4">
        <h2 className="mb-10 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          What we care about
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <ValueCard
            icon={Heart}
            title="The sport, first"
            body="Every feature is shaped by people who play, score, or organise kabaddi. We test changes against real raids, real defenders, real all-outs — not a generic sports template."
          />
          <ValueCard
            icon={Activity}
            title="Live, not stale"
            body="Scoring updates flow to public pages in under a second. Stats land in reports the moment a match ends. No batch jobs, no overnight rollups."
          />
          <ValueCard
            icon={Users}
            title="Free for hobbyists, fair at scale"
            body="A free league forever. Pro starts at ₹4,999/month, only when you need branding or more than 3 tournaments. Enterprise for federations and broadcasters."
          />
          <ValueCard
            icon={Globe}
            title="Built in India, for the world"
            body="Hosted in Mumbai for speed across the subcontinent, designed to handle the global kabaddi diaspora. Pricing in INR, GST handled, Razorpay-powered."
          />
          <ValueCard
            icon={Trophy}
            title="PKL ruleset, real depth"
            body="Raids, do-or-die, super tackles, all-outs, reviews, substitutions, cards — full ruleset with the edge cases handled. Not a checkbox list, a working system."
          />
          <ValueCard
            icon={Sparkles}
            title="Move at the speed of the season"
            body="Tournaments don't wait. We ship fixes the same day, ship features the same week. If something on the platform blocks your matchday, we treat it like a fire."
          />
        </div>
      </section>

      {/* CTA --------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <h2 className="font-display text-3xl uppercase tracking-tight md:text-4xl">
              Run your first tournament
            </h2>
            <p className="max-w-xl text-muted-foreground">
              Free forever for one league. No card needed. Set up your tournament,
              score your first match, share the live link with your fans — in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild variant="flame" size="lg">
                <Link href="/signup?role=organiser">Start free</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/contact">Get in touch</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function ValueCard({
  icon: Icon,
  title,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </CardContent>
    </Card>
  );
}
