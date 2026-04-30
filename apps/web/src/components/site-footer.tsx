import Link from 'next/link';
import { Logo } from '@/components/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-border/50 bg-background/50">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-8 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="text-sm text-muted-foreground">
              The platform for everything Kabaddi — tournaments, teams, fans.
            </p>
          </div>
          <FooterCol title="Product">
            <FooterLink href="/tournaments">Tournaments</FooterLink>
            <FooterLink href="/teams">Teams</FooterLink>
            <FooterLink href="/players">Players</FooterLink>
            <FooterLink href="/live">Live scoring</FooterLink>
          </FooterCol>
          <FooterCol title="Organisers">
            <FooterLink href="/signup?role=organiser">Host a tournament</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/docs">Docs</FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
            <FooterLink href="/terms">Terms</FooterLink>
          </FooterCol>
        </div>
        <div className="mt-12 border-t border-border/50 pt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Kabaddiadda. Built with passion for the sport.
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}
