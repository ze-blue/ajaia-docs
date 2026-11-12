import { SignUpForm } from '@/components/AuthForms';
import { AuthShell } from '@/components/AuthShell';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';

export default async function SignUpPage() {
  if (await currentUser()) redirect('/');
  return (
    <AuthShell title="Create your account">
      <SignUpForm />
    </AuthShell>
  );
}
