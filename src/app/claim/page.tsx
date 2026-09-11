import { ClaimCompForm, ClaimTeamForm } from "@/components/AccountForms";

export default function ClaimPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Code Claim</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Enter a claim code to attach this login to a team or a competition.
          First valid claim becomes the primary admin. You will be asked to
          confirm before it goes through.
        </p>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <ClaimTeamForm />
        <ClaimCompForm />
      </section>
    </div>
  );
}
