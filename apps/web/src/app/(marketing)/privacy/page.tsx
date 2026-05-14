import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Privacy policy — Kabaddiadda',
  description: 'How Kabaddiadda collects, uses, and protects your personal data.',
};

const SUPPORT_EMAIL = 'support@kabaddiadda.in';
const LAST_UPDATED = '2026-05-14';

export default function PrivacyPage() {
  return (
    <div className="py-16 md:py-20">
      <div className="container mx-auto max-w-3xl px-4">
        {/* DRAFT BANNER --------------------------------------------- */}
        <div className="mb-10 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <div className="font-semibold text-amber-500">Draft — review with a lawyer</div>
              <p className="mt-1 text-muted-foreground">
                This is a starter privacy policy reflecting how Kabaddiadda currently
                handles data. It is <strong>not legal advice</strong> and has not been
                reviewed by counsel. Before relying on it for compliance with India's
                DPDP Act 2023 (or GDPR for EU users), please have it reviewed and adapted
                by a qualified lawyer for your jurisdiction.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
            Privacy
          </Badge>
          <h1 className="font-display text-4xl uppercase leading-none tracking-tight md:text-5xl">
            Privacy policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed">
          <Section title="1. Who we are">
            <p>
              Kabaddiadda ("we", "us", "our") operates the website at kabaddiadda.in and
              the related platform that lets organisers run kabaddi tournaments and lets
              fans follow them. We are the data fiduciary (controller) responsible for
              your personal data when you use this service.
            </p>
            <p>
              Questions about this policy or about your personal data should be sent to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section title="2. What data we collect">
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Account data.</strong> Email address, password (hashed — we never
                see the plaintext), full name, role (fan / organiser / superadmin), and
                the league you belong to.
              </li>
              <li>
                <strong>Profile data.</strong> Optional fields you add — phone, avatar,
                preferences.
              </li>
              <li>
                <strong>Content you create.</strong> Tournament names, team names, player
                rosters, match events, and any other data you enter as an organiser.
              </li>
              <li>
                <strong>Payment data.</strong> When you subscribe to a paid plan, our
                payment partner Razorpay processes your card / UPI / bank details. We
                never see or store your card number; we only retain the transaction ID,
                amount, and status.
              </li>
              <li>
                <strong>Usage data.</strong> Pages you visit, actions you take, approximate
                geographic location derived from your IP address, browser and device
                type. Collected via PostHog (our product analytics tool) and Vercel Web
                Analytics (anonymous aggregate metrics).
              </li>
              <li>
                <strong>Communications.</strong> Messages you send us via the feedback
                widget, support email, or any contact form.
              </li>
              <li>
                <strong>Technical data.</strong> IP address, user agent, and basic
                request metadata when you visit the site.
              </li>
            </ul>
          </Section>

          <Section title="3. How we use it">
            <p>We use your data to:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Run the service — let you log in, save your tournaments, score matches, etc.</li>
              <li>
                Process payments and issue invoices (only for organisers on paid plans).
              </li>
              <li>
                Send service emails — password resets, billing receipts, important
                product changes. We do not send marketing emails without your consent.
              </li>
              <li>
                Improve the product — analyse which features are used, fix bugs, plan
                roadmap.
              </li>
              <li>
                Respond to support requests and abuse reports.
              </li>
              <li>
                Comply with legal obligations and enforce our Terms of Service.
              </li>
            </ul>
          </Section>

          <Section title="4. Who we share it with">
            <p>
              We do not sell your personal data. We share specific data with the third
              parties listed below, only to the extent needed to provide the service:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>
                <strong>Supabase.</strong> Our database and authentication provider —
                stores your account and all platform data. Hosted in their Mumbai (ap-south-1) region.
              </li>
              <li>
                <strong>Vercel.</strong> Our hosting provider — runs the web application
                and stores anonymous traffic metrics (Vercel Web Analytics).
              </li>
              <li>
                <strong>PostHog.</strong> Our product analytics tool — receives your
                page-view events with IP address and approximate location to help us
                understand product usage. Hosted in the US.
              </li>
              <li>
                <strong>Razorpay.</strong> Our payment processor — receives card / UPI
                details when you subscribe. We never see those details ourselves.
              </li>
              <li>
                <strong>Google Fonts.</strong> Loaded directly from Google to render
                custom fonts. Your IP is visible to Google when this happens.
              </li>
            </ul>
            <p>
              We may disclose your data to law enforcement or regulators if compelled by a
              valid legal process under Indian law.
            </p>
          </Section>

          <Section title="5. Cookies and similar technologies">
            <p>
              We use cookies and localStorage for: keeping you logged in (Supabase auth
              session), remembering your theme preference, and analytics (PostHog session
              cookies). We do not use third-party advertising or cross-site tracking
              cookies.
            </p>
            <p>
              You can clear cookies from your browser settings at any time. Doing so will
              log you out and reset preferences.
            </p>
          </Section>

          <Section title="6. How long we keep your data">
            <p>
              We keep your personal data as long as your account is active. If you delete
              your account, we delete your personal data within 30 days, except where we
              are required to retain certain records by law (for example, GST-related
              invoices are kept for 7 years).
            </p>
            <p>
              Anonymous analytics data may be retained for longer in aggregate form for
              product improvement.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>
              Under India's Digital Personal Data Protection Act 2023, you have the right
              to:
            </p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate or incomplete data.</li>
              <li>Request deletion of your personal data (subject to legal retention requirements).</li>
              <li>Withdraw consent for processing that relies on consent.</li>
              <li>Nominate someone to exercise these rights on your behalf if you are unable to.</li>
              <li>File a complaint with the Data Protection Board of India.</li>
            </ul>
            <p>
              To exercise any of these rights, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              from your registered address. We respond within 30 days.
            </p>
          </Section>

          <Section title="8. Children">
            <p>
              The service is not directed at children under 18. We do not knowingly
              collect personal data from minors. If you believe a child has provided us
              data, please contact us and we will delete it.
            </p>
          </Section>

          <Section title="9. International users">
            <p>
              The service is operated from India. If you access it from outside India,
              your data is transferred to and stored in India and other locations where
              our service providers operate (notably the US for PostHog). By using the
              service, you consent to this transfer.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use industry-standard security: TLS for all traffic, hashed passwords,
              row-level security in the database, and minimum-privilege access for our
              team. No system is perfect — if you discover a vulnerability, please report
              it to{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              and we will respond responsibly.
            </p>
          </Section>

          <Section title="11. Changes to this policy">
            <p>
              We may update this policy as the product or laws evolve. Material changes
              will be announced via a notice on the site and an email to registered
              users. The "Last updated" date at the top of this page reflects the most
              recent change.
            </p>
          </Section>

          <Section title="12. Contact">
            <Card className="border-border/60">
              <CardContent className="space-y-1 p-4 text-sm">
                <p>
                  <strong>Kabaddiadda — Privacy</strong>
                </p>
                <p>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="text-primary hover:underline"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              </CardContent>
            </Card>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="space-y-3 text-muted-foreground">{children}</div>
    </section>
  );
}
