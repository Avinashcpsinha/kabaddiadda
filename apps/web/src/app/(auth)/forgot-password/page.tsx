import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ForgotPasswordForm } from './forgot-password-form';

export const metadata = { title: 'Reset password' };

export default function ForgotPasswordPage() {
  return (
    <Card className="border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Forgot password?</CardTitle>
        <CardDescription>Enter your email and we&apos;ll send you a reset link.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ForgotPasswordForm />

        <p className="text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
