import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";

export default function LoginPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Log In</h1>
          <p className="mt-2 text-sm text-muted">
            Email and password only. After you sign in you land on your
            dashboard.
          </p>
        </div>
        <AuthForm mode="login" />
      </div>
    </PageShell>
  );
}
