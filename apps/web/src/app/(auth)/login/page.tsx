import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';
import { DevQuickLogin } from './dev-quick-login';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  const isDev = process.env.NODE_ENV !== 'production';

  return (
    <Card className="border-border/60 shadow-2xl shadow-primary/5">
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
        <CardDescription>Sign in to continue to Kabaddiadda</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <LoginForm />

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>

        {isDev && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>
            <DevQuickLogin />
          </>
        )}
      </CardContent>
    </Card>
  );
}
