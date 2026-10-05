import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";
import { googleAuthEnabled } from "@/lib/ops-admin";

export default function RegisterPage() {
  const googleEnabled = googleAuthEnabled();
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Create account</h1>
          <p className="mt-2 text-sm text-muted">
            Create your account with Google, then claim a team or competition
            with its code. Payment instructions are separate from sign-in.
          </p>
        </div>
        <AuthForm mode="register" googleEnabled={googleEnabled} />
      </div>
    </PageShell>
  );
}
