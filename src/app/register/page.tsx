import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";
import { googleAuthEnabled } from "@/lib/ops-admin";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
        {error === "no-account" ? (
          <p className="notice notice-error mx-auto max-w-md">
            There is no OneLegends account for that Google email yet. Create
            one below, then you can log in with it any time.
          </p>
        ) : null}
        <AuthForm mode="register" googleEnabled={googleEnabled} />
      </div>
    </PageShell>
  );
}
