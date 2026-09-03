import { AuthForm } from "@/components/AuthForm";
import { PageShell } from "@/components/PageShell";

function parseRole(value: string | undefined) {
  if (value === "TEAM" || value === "COMP" || value === "JUDGE") return value;
  return "TEAM";
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { role } = await searchParams;

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="mt-2 font-heading text-3xl tracking-[0.08em]">Register</h1>
          <p className="mt-2 text-sm text-muted">
            Create a team or judge account, or claim a competition with your
            bid code. Payment stays off this site.
          </p>
        </div>
        <AuthForm mode="register" defaultRole={parseRole(role)} />
      </div>
    </PageShell>
  );
}
