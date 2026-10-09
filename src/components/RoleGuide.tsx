"use client";

import { useState } from "react";
import Link from "next/link";

type GuideId = "TEAM" | "JUDGE" | "COMP" | "MODERATOR" | "OPS";

type Guide = {
  id: GuideId;
  tab: string;
  kicker: string;
  title: string;
  intro: string;
  steps: { title: string; body: string }[];
  cta: { href: string; label: string };
  signedInCta?: { href: string; label: string };
};

const GUIDES: Guide[] = [
  {
    id: "TEAM",
    tab: "Teams",
    kicker: "One login · claim code",
    title: "How teams apply",
    intro:
      "Everyone signs in with Google. Circuit ops creates the team listing and a claim code. The first person to enter that code becomes the primary admin. Payment stays off this site.",
    steps: [
      {
        title: "Register once",
        body: "New here? Choose Create account and continue with Google. Returning users choose Log In with the same Google account. Signing in does not create a team. Your dashboard is the starting point for profiles, applications, and invitations.",
      },
      {
        title: "Claim the team with the code",
        body: "Get your team's code from circuit ops, open Code Claim, and check the team name before confirming. The first successful claim becomes primary admin. If the team is already claimed, ask its primary admin for an invitation instead.",
      },
      {
        title: "Invite secondary admins by email",
        body: "The primary admin can invite secondary admins using their Google email addresses. Tell them directly: OneLegends does not send email. They approve in the sign-in popup or Dashboard → Requests. To switch teams, choose Active team on your dashboard. Finish edits before switching and reload any other open team tabs.",
      },
      {
        title: "Fill Team Profile and roster",
        body: "Open Team Profile and complete the required details, uploaded logo, and Google Drive file link. Use Save Team Profile, then list dancers with their t-shirt sizes and use Save roster separately. Check that the AV file plays for someone outside your Google account; a valid link alone does not grant viewing access.",
      },
      {
        title: "Apply, then check status and payment",
        body: "Once the profile and roster are complete, select open competitions and submit. Check Applications on your dashboard for each entry and its status. The late deadline closes applications; circuit blocks can also prevent new applications. Follow Payments separately and keep your receipt: an application does not confirm payment.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "JUDGE",
    tab: "Judges",
    kicker: "Email invite · shared viewing",
    title: "How judges score",
    intro:
      "Use the Google email invited by the competition. There is no judge claim code. The moderator plays and shares the videos; every judge follows the same anonymous team order and keeps their own scores.",
    steps: [
      {
        title: "Register or log in",
        body: "Choose Create account the first time, or Log In if you already registered. Use the Google account that received the invitation. You do not select a role during registration.",
      },
      {
        title: "Approve the invite",
        body: "OneLegends does not send invitation emails. Approve the in-app invitation in the sign-in popup or Dashboard → Requests, then open Judging. If the invitation is missing, ask the competition to check the Google email it entered.",
      },
      {
        title: "Join the moderator's viewing session",
        body: "Circuit ops opens judging after applications close. Open your assigned competition in Judging and watch the moderator's shared video. The moderator selects the live team, and your score sheet follows. Judges do not open Drive videos in OneLegends. Report playback problems to the moderator.",
      },
      {
        title: "Score Team 1, Team 2, …",
        body: "Score 0–10 for choreography, formations, technique, sync & cleanliness, and overall impression (50 total). Scores save automatically. Wait for Saving… to finish and resolve any error before moving on. The moderator advances when every approved judge has filled all five scores. You can revisit earlier teams while judging is open; future teams stay locked. Comments are optional and visible to the competition after release.",
      },
      {
        title: "Submit Judging when every slot is filled",
        body: "Check that every team is fully scored, then use Submit Judging on the packet overview. Submission locks your packet. Closing judging also pauses edits, and results release locks all scoring. Judges never receive team names, other judges' scores, or final rankings.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "COMP",
    tab: "Competitions",
    kicker: "Claim code · then invite",
    title: "How competitions run apps",
    intro:
      "Everyone signs in with Google. Circuit ops creates the competition listing and a claim code. The first person to enter that code becomes the primary admin. Applied Teams shows names, application dates, and dancer counts for payment checks.",
    steps: [
      {
        title: "Register, then claim with the claim code",
        body: "Use Create account with Google the first time, then get your competition code from circuit ops. Open Code Claim and confirm the listing. Already claimed? Ask its primary admin to invite your Google email. The primary admin can invite secondary admins; invitees approve in the sign-in popup or Dashboard → Requests.",
      },
      {
        title: "Save Comp Details and deadlines",
        body: "Choose the active competition, then open Comp Details. Save its dates, venue, production details, deadlines, and application setting. The early deadline is informational; the late deadline closes applications. Check the labeled timezone. Finish edits before switching competitions and reload other open tabs. Circuit ops controls the official name.",
      },
      {
        title: "Invite judges and set the required count",
        body: "Open Judges, enter each judge's Google email, and tell them to approve the in-app invitation. OneLegends does not send email. Set the required number of submitted packets before viewing begins. This count controls when results release, so coordinate any later change with circuit ops.",
      },
      {
        title: "Coordinate live viewing",
        body: "Close applications and ask circuit ops to open judging. For partner competitions, circuit ops grants a separate moderator access. Approved admins of non-partner competitions can use Open Live Viewing themselves, unless they are judging that competition. The moderator shares the videos and advances the anonymous team order.",
      },
      {
        title: "Review automatically released results",
        body: "Applied Teams shows applicant names, application dates, and dancer counts before release. Once the required number of approved judges submit, results unlock automatically. Open Viewing Results for rankings, scores, and comments, then review full applicant details and set accept, waitlist, or decline decisions. Judges cannot see this table.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "MODERATOR",
    tab: "Moderators",
    kicker: "Assigned access · live videos",
    title: "How moderators run viewing",
    intro:
      "The moderator plays the AVs and controls which anonymous team the judges score. Use a separate account from circuit admins and from anyone judging the same competition.",
    steps: [
      {
        title: "Get access and open Live Viewing",
        body: "Ask circuit ops to grant access to your Google email, then register or log in with that account. Open Live Viewing from your dashboard and choose the competition. Approved non-partner competition admins also have this access unless they judge that competition.",
      },
      {
        title: "Wait for circuit ops to open judging",
        body: "Applications must be closed first. Coordinate the video-sharing call with the judges and check that each AV plays. Share the player, keeping team names and identifying file titles out of the judges' view. Ask the team to fix sharing on the same Drive file if playback fails; AV links are locked once viewing order is assigned.",
      },
      {
        title: "Show the live team",
        body: "Use Show Team 1 to begin. Judges' sheets follow the selected team. Play its video, then check the completion marks beside each judge. Next stays unavailable until every approved judge has completed all five scores for the earlier teams.",
      },
      {
        title: "Pause or revisit when needed",
        body: "Use Clear screen to pause the live selection or select an earlier team to revisit it. Ask circuit ops to close judging when score edits must stop. After the final video, remind judges to submit their complete packets.",
      },
      {
        title: "Open final rankings after release",
        body: "Results release automatically when the required number of approved judges submit. Live viewing then closes. Use View final rankings for the read-only ranking table; applicant decisions and detailed judge comments belong to competition admins.",
      },
    ],
    cta: { href: "/login", label: "Log in" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "OPS",
    tab: "Circuit ops",
    kicker: "Circuit access · event controls",
    title: "How circuit admins support an event",
    intro:
      "Circuit-admin access is granted by an existing circuit admin. Signing in or claiming a team or competition does not grant these controls.",
    steps: [
      {
        title: "Create listings and share claim codes",
        body: "From Dashboard, create the official team and competition listings. Set competitions as partner or non-partner, then give each primary contact its code through your normal private channel. OneLegends does not email codes or invitations.",
      },
      {
        title: "Check profiles, access, and eligibility",
        body: "Use Teams and Competitions to expand each listing and inspect its details and admins. Resolve application blocks with the team. Payments and eligibility checks are manual; the app does not confirm receipt of dues.",
      },
      {
        title: "Prepare the moderator and judges",
        body: "Grant the moderator the correct competition from Dashboard. Use an account separate from circuit admins and the judges scoring that competition. Confirm that applications are closed, there are applicants, and the competition has invited its judges with the intended required packet count.",
      },
      {
        title: "Open and monitor judging",
        body: "Open Comp Dashboard, choose the competition, and use Open judging. The moderator runs the video player; Comp Dashboard shows live progress and saved scores. Close judging to pause scoring. Results release automatically at the required number of submissions and cannot be reopened through these controls.",
      },
      {
        title: "Export and manage handoffs carefully",
        body: "Use Export data for CSV or Excel files and keep them in the board's private storage. Review the confirmation before removing a primary admin or resetting a claim: those actions change access and can issue a new code. Coordinate ownership handoffs with the people involved.",
      },
    ],
    cta: { href: "/login", label: "Log in" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
];

export function RoleGuide({ signedIn, standalone }: { signedIn?: boolean; standalone?: boolean }) {
  const [activeId, setActiveId] = useState<GuideId>("TEAM");
  const Heading = standalone ? "h1" : "h2";
  const GuideHeading = standalone ? "h2" : "h3";
  const index = GUIDES.findIndex((g) => g.id === activeId);
  const guide = GUIDES[index] ?? GUIDES[0];

  function go(delta: number) {
    const next = (index + delta + GUIDES.length) % GUIDES.length;
    setActiveId(GUIDES[next].id);
  }

  const cta =
    signedIn && guide.signedInCta ? guide.signedInCta : guide.cta;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Heading className="font-heading text-2xl tracking-[0.12em]">
            How it works
          </Heading>
          <p className="mt-2 max-w-2xl text-muted">
            One login for everyone. Teams and competitions are claimed with a
            code. Judges approve invitations in-app; circuit ops grants moderator
            access. Choose your role below for the next steps.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_rgba(142,28,66,0.06)]">
        <div
          role="tablist"
          aria-label="Choose a walkthrough"
          className="grid grid-cols-2 border-b border-line bg-blush sm:grid-cols-3 lg:grid-cols-5"
        >
          {GUIDES.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                id={`guide-tab-${item.id}`}
                aria-controls={`guide-panel-${item.id}`}
                onClick={() => setActiveId(item.id)}
                onKeyDown={(event) => {
                  const current = GUIDES.findIndex((entry) => entry.id === item.id);
                  const next = event.key === "ArrowRight" ? (current + 1) % GUIDES.length
                    : event.key === "ArrowLeft" ? (current - 1 + GUIDES.length) % GUIDES.length
                    : event.key === "Home" ? 0
                    : event.key === "End" ? GUIDES.length - 1
                    : null;
                  if (next === null) return;
                  event.preventDefault();
                  setActiveId(GUIDES[next].id);
                  document.getElementById(`guide-tab-${GUIDES[next].id}`)?.focus();
                }}
                className={`relative px-3 py-3.5 text-center text-xs font-bold uppercase tracking-[0.14em] transition sm:text-sm ${
                  selected
                    ? "bg-card text-accent"
                    : "text-muted hover:bg-card/60 hover:text-ink"
                }`}
              >
                {item.tab}
                {selected ? (
                  <span className="brand-gradient absolute inset-x-6 bottom-0 h-0.5 rounded-full" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div
          id={`guide-panel-${guide.id}`}
          role="tabpanel"
          aria-labelledby={`guide-tab-${guide.id}`}
          className="relative px-5 py-6 sm:px-8 sm:py-8"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent">
            {guide.kicker}
          </p>
          <GuideHeading className="mt-2 font-heading text-xl tracking-[0.08em] sm:text-2xl">
            {guide.title}
          </GuideHeading>
          <p className="mt-2 max-w-2xl text-sm text-ink/80 sm:text-base">
            {guide.intro}
          </p>

          <ol className="mt-6 space-y-4">
            {guide.steps.map((step, i) => (
              <li key={step.title} className="flex gap-3 sm:gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blush font-heading text-xs text-accent">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <p className="font-semibold text-ink">{step.title}</p>
                  <p className="mt-0.5 text-sm leading-relaxed text-muted">
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link href={cta.href} className="btn btn-primary w-fit">
              {cta.label}
            </Link>
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5" aria-hidden>
                {GUIDES.map((item) => (
                  <span
                    key={item.id}
                    className={`h-1.5 rounded-full transition-all ${
                      item.id === activeId
                        ? "w-6 bg-accent"
                        : "w-1.5 bg-line"
                    }`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="btn btn-ghost px-3 py-2"
                  aria-label="Previous guide"
                >
                  ‹
                </button>
                <button
                  type="button"
                  onClick={() => go(1)}
                  className="btn btn-ghost px-3 py-2"
                  aria-label="Next guide"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
