import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";

export default function LoginPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Log In</h1>
          <p className="mt-2 text-sm text-muted">
            Team, competition, and judge accounts are separate. Competitions
            claim their listing with a bid code when they register.
          </p>
        </div>
        <AuthForm mode="login" />
      </div>
    </PageShell>
  );
}
