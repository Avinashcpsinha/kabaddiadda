import { Suspense } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ResetPasswordForm } from './reset-password-form';

export const metadata = { title: 'Choose a new password' };

export default function ResetPasswordPage() {
  return (
    <Card className="border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Choose a new password</CardTitle>
        <CardDescription>Pick a strong password you don&apos;t use elsewhere.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  );
}
