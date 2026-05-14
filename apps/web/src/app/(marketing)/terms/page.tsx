import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export const metadata = {
  title: 'Terms of service — Kabaddiadda',
  description: 'The agreement between you and Kabaddiadda when you use the service.',
};

const SUPPORT_EMAIL = 'support@kabaddiadda.in';
const LAST_UPDATED = '2026-05-14';

export default function TermsPage() {
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
                These are starter terms reflecting how Kabaddiadda currently operates.
                They are <strong>not legal advice</strong> and have not been reviewed by
                counsel. Before relying on them — especially the limitation of liability,
                refund, and governing-law clauses — please have a qualified lawyer
                review and adapt them to your business needs.
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <Badge variant="outline" className="mb-3 border-primary/30 text-primary">
            Legal
          </Badge>
          <h1 className="font-display text-4xl uppercase leading-none tracking-tight md:text-5xl">
            Terms of service
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
        </div>

        <div className="space-y-8 text-sm leading-relaxed">
          <Section title="1. Acceptance of these terms">
            <p>
              By creating an account on or otherwise using Kabaddiadda (the
              "Service"), you agree to be bound by these Terms of Service ("Terms"). If
              you do not agree, do not use the Service. We may update these Terms from
              time to time; material changes will be notified to registered users by
              email and posted on this page. Continued use after notification means you
              accept the updated Terms.
            </p>
          </Section>

          <Section title="2. The service">
            <p>
              Kabaddiadda is a software platform for organising kabaddi tournaments,
              managing teams and players, recording match events, and sharing results
              with fans. The Service is offered on a software-as-a-service basis with
              free and paid plans (see /pricing).
            </p>
          </Section>

          <Section title="3. Accounts">
            <p>
              You must provide accurate information when signing up and keep your login
              credentials confidential. You are responsible for all activity under your
              account. Notify us immediately at{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              if you suspect unauthorised access.
            </p>
            <p>
              You must be at least 18 years old, or have a parent or guardian's consent,
              to use the Service. The Service is not directed at children under 18.
            </p>
          </Section>

          <Section title="4. Subscription and billing">
            <p>
              Paid plans are billed monthly in advance via Razorpay. By subscribing, you
              authorise us (and Razorpay) to charge your chosen payment method on the
              same date each month until you cancel.
            </p>
            <p>
              Prices are shown in INR and are exclusive of GST. GST at the prevailing rate
              (18% at time of writing) is added at checkout and shown on your invoice.
            </p>
            <p>
              You may cancel any time from your billing page. Cancellation takes effect
              at the end of the current billing period — you keep paid features until
              then, then drop to the Free tier.
            </p>
            <p>
              <strong>Refunds.</strong> We do not offer refunds for partial billing
              periods. If you believe you were charged in error, email{' '}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
                {SUPPORT_EMAIL}
              </a>{' '}
              within 7 days and we will investigate in good faith. Refunds, when granted,
              are processed back to the original payment method within 7 working days.
            </p>
          </Section>

          <Section title="5. Free tier">
            <p>
              The Free tier is offered without payment and includes limits documented at
              /pricing (currently 3 tournaments, 30 teams). We may change these limits
              with reasonable notice. Free-tier accounts may be suspended for inactivity
              after 12 months; we will email you before doing so.
            </p>
          </Section>

          <Section title="6. Your content">
            <p>
              You retain ownership of the data and content you upload to the Service —
              tournament details, team names, player rosters, match events, branding
              assets, etc. ("Your Content"). You grant us a limited, non-exclusive
              licence to host, copy, transmit, and display Your Content solely to operate
              the Service.
            </p>
            <p>
              You are responsible for ensuring you have the right to upload and share
              Your Content, including any photographs or personal details of players,
              and for obtaining any consents required under applicable law.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc space-y-2 pl-6 text-muted-foreground">
              <li>Violate any law or third-party right.</li>
              <li>
                Upload content that is defamatory, obscene, hateful, harassing, or that
                infringes intellectual-property rights.
              </li>
              <li>
                Attempt to gain unauthorised access to the Service, other accounts, or
                the underlying infrastructure.
              </li>
              <li>
                Interfere with the Service — denial-of-service attempts, abusive
                scraping, exploiting bugs without responsible disclosure.
              </li>
              <li>
                Use the Service to send spam or unsolicited communications.
              </li>
              <li>
                Resell or sublicence the Service without our written agreement.
              </li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate this section without
              notice in serious cases.
            </p>
          </Section>

          <Section title="8. Our intellectual property">
            <p>
              The Service, including all software, design, text, and branding, is owned
              by Kabaddiadda and protected by intellectual-property laws. You are granted
              a limited, non-transferable, non-exclusive licence to use the Service
              while these Terms are in effect.
            </p>
          </Section>

          <Section title="9. Service availability and changes">
            <p>
              We aim for high availability but do not guarantee uninterrupted service.
              Maintenance windows will be announced where possible. We may add, modify,
              or remove features at any time. For paid features removed during a billing
              period, we will offer a pro-rated refund or credit at our discretion.
            </p>
          </Section>

          <Section title="10. Disclaimer of warranties">
            <p>
              The Service is provided "as is" and "as available". To the maximum extent
              permitted by Indian law, we disclaim all warranties — express or implied —
              including merchantability, fitness for a particular purpose, and
              non-infringement. We do not warrant that the Service will be uninterrupted,
              error-free, or that any defects will be corrected.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              To the maximum extent permitted by law, Kabaddiadda's total cumulative
              liability arising out of or relating to the Service is limited to the
              greater of (a) the amount you paid us in the 12 months preceding the claim,
              or (b) ₹10,000.
            </p>
            <p>
              We are not liable for indirect, incidental, special, consequential, or
              punitive damages — including lost profits, lost data, or business
              interruption — even if we have been advised of the possibility.
            </p>
          </Section>

          <Section title="12. Indemnity">
            <p>
              You agree to indemnify and hold Kabaddiadda harmless against any claim
              brought by a third party arising from Your Content, your use of the
              Service, or your breach of these Terms.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may delete your account at any time from settings; data is removed
              within 30 days, subject to retention required by law. We may suspend or
              terminate your account if you materially breach these Terms, with notice
              where reasonable and immediately where the breach is severe (security
              abuse, illegal content). Sections that by their nature should survive
              termination (intellectual property, disclaimers, liability, indemnity,
              governing law) will continue to apply.
            </p>
          </Section>

          <Section title="14. Governing law and disputes">
            <p>
              These Terms are governed by the laws of India. Any dispute arising out of
              or in connection with the Service or these Terms is subject to the
              exclusive jurisdiction of the courts at Bengaluru, Karnataka, India.
            </p>
            <p>
              Before initiating any formal proceeding, the parties will attempt in good
              faith to resolve the dispute by email correspondence for at least 30 days.
            </p>
          </Section>

          <Section title="15. Severability and waiver">
            <p>
              If any provision of these Terms is held unenforceable, the remaining
              provisions remain in effect. Our failure to enforce any right is not a
              waiver of that right.
            </p>
          </Section>

          <Section title="16. Contact">
            <Card className="border-border/60">
              <CardContent className="space-y-1 p-4 text-sm">
                <p>
                  <strong>Kabaddiadda — Legal</strong>
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
