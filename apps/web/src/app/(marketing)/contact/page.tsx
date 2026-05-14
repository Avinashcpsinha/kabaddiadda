import Link from 'next/link';
import { Bug, CreditCard, HelpCircle, Mail, MessageSquare, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Contact — get in touch with Kabaddiadda',
  description:
    'Email support@kabaddiadda.in for help with your account, billing, or to talk to us about hosting your league on Kabaddiadda.',
};

const SUPPORT_EMAIL = 'support@kabaddiadda.in';

export default function ContactPage() {
  return (
    <div className="space-y-16 py-16 md:py-24">
      {/* HERO -------------------------------------------------------- */}
      <section className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl text-center">
          <Badge variant="outline" className="mb-4 border-primary/30 text-primary">
            Contact
          </Badge>
          <h1 className="text-balance font-display text-5xl uppercase leading-none tracking-tight md:text-6xl">
            We're <span className="text-primary">listening.</span>
          </h1>
          <p className="mt-6 text-balance text-lg text-muted-foreground">
            One inbox handles everything — support, sales, billing, partnerships. The
            fastest way to flag something broken is the Feedback button in the corner
            of every page.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild variant="flame" size="lg">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                Email us
              </a>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </section>

      {/* WHAT TO REACH OUT FOR --------------------------------------- */}
      <section className="container mx-auto px-4">
        <h2 className="mb-10 text-center font-display text-3xl uppercase tracking-tight md:text-4xl">
          What can we help with?
        </h2>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          <TopicCard
            icon={Bug}
            title="Something broke"
            body="Use the Feedback button on any page — it captures the URL, the time, and lets us follow up. Faster than email."
            cta={{ label: 'Use the feedback widget', href: '/feed' }}
          />
          <TopicCard
            icon={HelpCircle}
            title="Need help using the platform"
            body="Walk-throughs, setup questions, score-an-event-the-rules-don't-cover. Email us with screenshots and we'll dig in."
            cta={{ label: 'Email support', href: `mailto:${SUPPORT_EMAIL}?subject=Help` }}
          />
          <TopicCard
            icon={CreditCard}
            title="Billing or subscription"
            body="Invoices, GST queries, payment failures, refunds, plan changes. Include your league name and registered email."
            cta={{
              label: 'Email billing',
              href: `mailto:${SUPPORT_EMAIL}?subject=Billing`,
            }}
          />
          <TopicCard
            icon={Sparkles}
            title="Enterprise / federation"
            body="Custom domains, white-label, SLA support, sponsor slots, broadcaster integrations. Tell us about your league and we'll get back within a working day."
            cta={{
              label: 'Talk to sales',
              href: `mailto:${SUPPORT_EMAIL}?subject=Enterprise%20enquiry`,
            }}
          />
          <TopicCard
            icon={MessageSquare}
            title="Partnerships & press"
            body="Media coverage, broadcaster tie-ups, sponsor partnerships, or just say hello — we love hearing from the kabaddi community."
            cta={{
              label: 'Send a note',
              href: `mailto:${SUPPORT_EMAIL}?subject=Partnership`,
            }}
          />
          <TopicCard
            icon={Mail}
            title="Privacy or data request"
            body="Want to know what data we hold, or request deletion under India's DPDP Act? Email us and we'll respond inside 30 days."
            cta={{
              label: 'Privacy request',
              href: `mailto:${SUPPORT_EMAIL}?subject=Privacy%20request`,
            }}
          />
        </div>
      </section>

      {/* RESPONSE TIMES ---------------------------------------------- */}
      <section className="container mx-auto px-4">
        <Card className="mx-auto max-w-3xl border-border/60">
          <CardContent className="space-y-3 p-8">
            <h2 className="font-display text-2xl uppercase tracking-tight">
              Response times
            </h2>
            <p className="text-sm text-muted-foreground">
              We're a small team, but we read everything. Typical turnarounds:
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <span className="font-semibold">Bug reports via the in-app widget:</span>{' '}
                same working day for matchday-blocking issues.
              </li>
              <li>
                <span className="font-semibold">Support email:</span> within 1 working
                day on weekdays.
              </li>
              <li>
                <span className="font-semibold">Enterprise enquiries:</span> within 1
                working day with a call scheduled if needed.
              </li>
            </ul>
            <p className="pt-2 text-xs text-muted-foreground">
              Office hours follow IST. Saturdays and Sundays — best-effort only.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function TopicCard({
  icon: Icon,
  title,
  body,
  cta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  cta: { label: string; href: string };
}) {
  const external = cta.href.startsWith('mailto:') || cta.href.startsWith('http');
  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-6">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h3 className="font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
        {external ? (
          <a
            href={cta.href}
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {cta.label} →
          </a>
        ) : (
          <Link
            href={cta.href}
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            {cta.label} →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
