import Link from "next/link";

const steps = [
  {
    number: "01",
    title: "Build one team profile",
    body: "Keep your team story, logo, captains, audition video, and dancer roster together. Mark dancers who are points of contact or sober monitors, then use that profile throughout the season.",
  },
  {
    number: "02",
    title: "Find and apply to competitions",
    body: "Browse event dates, venues, stages, and application deadlines. Send your completed profile to the competitions you choose and follow each host’s payment instructions separately.",
  },
  {
    number: "03",
    title: "Watch and judge together",
    body: "A moderator runs the shared AV viewing. Judges follow the same live Team number and score choreography, formations, technique, sync and cleanliness, and overall impression in their own anonymous packets.",
  },
  {
    number: "04",
    title: "Turn scores into decisions",
    body: "After judging is complete, competition hosts finalize results to review rankings, scores, comments, and applicant details, then accept, waitlist, or decline teams. Teams can track where their applications stand.",
  },
];

const roles = [
  {
    title: "For teams",
    body: "One home for your profile, roster, AV, competition applications, and invited team admins.",
  },
  {
    title: "For competition hosts",
    body: "Set event details and deadlines, invite judges, follow applicants, and make decisions after results are released.",
  },
  {
    title: "For judges",
    body: "Score each AV against the same five-part rubric, with team identities hidden during judging.",
  },
  {
    title: "For moderators",
    body: "Guide the live viewing so the AV on screen and judges’ score sheets stay in step.",
  },
  {
    title: "For Legends staff",
    body: "Coordinate the circuit, follow judging progress, and prepare season reports.",
  },
];

export function PublicHowItWorks() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16" aria-labelledby="how-it-works-heading">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-accent">OneLegends</p>
        <h2 id="how-it-works-heading" className="mt-2 font-heading text-3xl tracking-[0.08em] sm:text-4xl">
          How it works
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted sm:text-lg">
          From the first application to the final decision, OneLegends brings
          the people and work of the Legends circuit into one place.
        </p>
      </div>

      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <li key={step.number} className="rounded-2xl border border-line bg-card p-6 shadow-[0_12px_40px_rgba(142,28,66,0.06)]">
            <span className="font-heading text-sm text-accent">{step.number}</span>
            <h3 className="mt-3 font-heading text-xl">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12">
        <h3 className="font-heading text-2xl">Made for everyone who runs the season</h3>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.title} className="rounded-xl border border-line bg-blush p-5">
              <h4 className="font-semibold text-ink">{role.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-muted">{role.body}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/register" className="btn btn-primary">Create an account</Link>
      </div>
    </section>
  );
}
