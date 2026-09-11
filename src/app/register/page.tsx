import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";

export default function RegisterPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Create account</h1>
          <p className="mt-2 text-sm text-muted">
            Create one login. After you sign in, open Code Claim with a code.
            Payment stays off this site.
          </p>
        </div>
        <AuthForm mode="register" />
      </div>
    </PageShell>
  );
}
