import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";
import { googleAuthEnabled } from "@/lib/ops-admin";

export default function LoginPage() {
  const googleEnabled = googleAuthEnabled();
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Log In</h1>
          <p className="mt-2 text-sm text-muted">
            {googleEnabled
              ? "Google or email and password. After you sign in you land on your dashboard."
              : "Email and password. After you sign in you land on your dashboard."}
          </p>
        </div>
        <AuthForm mode="login" googleEnabled={googleEnabled} />
      </div>
    </PageShell>
  );
}
