"use client";

import { useState } from "react";
import Link from "next/link";
import { DriveAvPlayer } from "@/components/DriveAvPlayer";

type GuideId = "TEAM" | "JUDGE" | "MODERATOR" | "COMP" | "OPS";

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
      "Circuit ops creates a team listing and gives its claim code to the team. The first person to claim it becomes the primary admin. Applications and payments are handled separately.",
    steps: [
      {
        title: "Register with Google",
        body: "New here? Choose Create account with Google. Returning users choose Log In with the same account. Then open Code Claim from the dashboard; signing in does not create a team.",
      },
      {
        title: "Claim the team with the code",
        body: "Enter the code from circuit ops. The first successful claim becomes the primary admin and uses the code up. If the team was already claimed, the app shows a masked admin email.",
      },
      {
        title: "Invite secondary admins by email",
        body: "Any approved admin can invite other admins by email. Invites appear under Requests when those people sign in or register; they must approve before they can manage the team. The primary admin can later transfer ownership, and only the primary can remove other admins. The app does not send invitation emails.",
      },
      {
        title: "Fill Team Profile and roster",
        body: "Save Team Profile with the blurb, captains, logo, years established, roster size, and a shareable Google Drive file for the audition video. Separately add each dancer with a shirt size, mark anyone serving as Point of Contact, and Save roster. Both saves must be complete before applying.",
      },
      {
        title: "Apply with checkboxes",
        body: "Select every open competition you want and submit once. Check its regular and late deadlines; the late deadline closes applications. Pay the $25 OneLegends registration fee outside the app; you can apply while it is pending, but tech admins must verify it before your AV enters viewing. Check each competition's separate payment instructions; its host tracks whether it received your payment.",
      },
      {
        title: "Respond to competition decisions",
        body: "Open Decisions after a competition announces its final outcomes. An accepted decision is an offer: confirm or decline it after reviewing the confirmation screen. You can confirm up to three Partner competitions. Affiliate and Non-partner confirmations have no limit. A waitlist position is not a confirmed spot.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/claim", label: "Code Claim" },
  },
  {
    id: "JUDGE",
    tab: "Judges",
    kicker: "Email invite · blind packets",
    title: "How judges score",
    intro:
      "Competition admins invite judges by email. Judges score anonymous Team numbers while the moderator plays audition videos on a shared screen.",
    steps: [
      {
        title: "Register or log in",
        body: "Use the same Google account that received the invitation. There is no judge claim code or role picker at registration.",
      },
      {
        title: "Approve the invite",
        body: "The invitation appears under Requests on your dashboard. Accept it to join the competition's approved judges, then review your judge profile. The app does not email the invitation.",
      },
      {
        title: "Wait for judging to open",
        body: "Circuit ops closes applications and opens judging. Join the moderator's video-sharing session; the moderator plays the videos and chooses the live team. Your packet stays locked until judging opens, and each team is identified only by number.",
      },
      {
        title: "Score Team 1, Team 2, …",
        body: "The moderator selects the live team, and your sheet follows. Score choreography, formations, technique, sync & cleanliness, and overall impression from 0–10 each. Scores and comments save automatically after a short pause, or you can click Save to save immediately. You may edit earlier teams until submission; future teams stay locked.",
      },
      {
        title: "Review Scores, then Submit Scores",
        body: "After the last team is saved, choose Review Scores to return to the packet list and check every team. When every slot has all five scores, click Submit Scores to lock the packet. Your submission does not release results; only a tech admin validates results after every active judge submits and pending invitations are resolved. Judges do not see team names, other judges’ scores, or rankings.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "MODERATOR",
    tab: "Moderators",
    kicker: "Assigned access · live viewing",
    title: "How moderators run viewing",
    intro:
      "Moderators control the shared audition video and the live Team number. Judges follow that number on their own score sheets while teams stay anonymous.",
    steps: [
      {
        title: "Sign in with your assigned email",
        body: "Competition admins or circuit ops assign a moderator for Partner and Affiliate competitions. Use an account separate from tech admins and judges scoring that competition. For a Non-partner competition, approved competition admins also get moderator controls. There is no moderator claim code or judge packet for this role.",
      },
      {
        title: "Open Live Viewing",
        body: "Find your assigned competition from the dashboard. Circuit ops must close applications and open judging before you can show a team.",
      },
      {
        title: "Show each anonymous team",
        body: "Select Team 1 to load its audition video, then play it for the judges on a shared screen. Keep team names and identifying file titles out of the judges' view. Their score sheets move to the same Team number automatically.",
      },
      {
        title: "Watch judging progress",
        body: "You can return to an earlier team or use Clear screen to pause the live selection. Moving ahead waits until every approved judge has completed all five scores for each earlier team.",
      },
      {
        title: "View completed rankings",
        body: "After every active judge submits a complete packet and all pending judge invitations are resolved, you can see read-only rankings. They become final when a competition or tech admin finalizes results. Moderator access does not include full rosters, judge comments, or competition decisions.",
      },
    ],
    cta: { href: "/login", label: "Log in" },
    signedInCta: { href: "/moderator", label: "Open live viewing" },
  },
  {
    id: "COMP",
    tab: "Competitions",
    kicker: "Claim code · then invite",
    title: "How competitions run apps",
    intro:
      "Circuit ops creates the competition listing and gives its claim code to an admin. Competition admins manage details, judge invitations, and applications; circuit ops controls when judging opens.",
    steps: [
      {
        title: "Register, then claim with the claim code",
        body: "Register with Google, then enter the code from circuit ops in Code Claim. The first successful claim becomes the primary admin and uses the code up. The app does not email claim codes.",
      },
      {
        title: "Invite secondary admins",
        body: "Any approved competition admin can invite additional admins by email. Invitees approve under Requests before gaining access. The primary admin can transfer ownership, and only the primary can remove other admins.",
      },
      {
        title: "Set Comp Details",
        body: "Save event details, production notes, and regular and late application deadlines. The regular deadline is informational; the late deadline closes applications. Check the labeled timezone. The competition name stays tied to the official listing. Finish edits before switching competitions or tabs.",
      },
      {
        title: "Invite judges and check applicants",
        body: "Invite judges by email. Their acceptance adds them to the active panel; review any separate pending judge requests on the Judges page. The app stores invitations but does not send email. Applied Teams shows applicant names, dates, and dancer counts before results. Use Payment received there to track the host fee you collect outside OneLegends, including before AV viewing.",
      },
      {
        title: "Review released results",
        body: "Circuit ops opens judging after applications close. Once every active judge submits and pending invitations are resolved, a tech admin validates and releases Partner and Affiliate results; Non-partner results release when judging finishes. Rankings, comments, full applicant rosters, and decisions then unlock for the competition account. Non-partner admins can run live viewing; Partner and Affiliate competitions use assigned moderators.",
      },
      {
        title: "Announce offers and manage the waitlist",
        body: "Save draft outcomes privately, then submit one final outcome for every applicant. Accepted teams receive an offer and must confirm their spot. Applied Teams tracks confirmed, awaiting response, declined, and waitlisted teams. When a spot opens, offer it manually to an available waitlisted team.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/claim", label: "Code Claim" },
  },
  {
    id: "OPS",
    tab: "Circuit ops",
    kicker: "Listings · access · judging",
    title: "How circuit ops runs the season",
    intro:
      "Legends Admin manages official listings and access across the circuit, then opens judging when applications are closed.",
    steps: [
      {
        title: "Create official listings",
        body: "Create team and competition listings, choose Partner, Affiliate, or Non-partner for each competition, and hand claim codes to the intended primary admins outside the app.",
      },
      {
        title: "Manage access",
        body: "Review team and competition admins, help assign Partner and Affiliate competition moderators, transfer or reset ownership when needed, and rotate claim codes. Mark OneLegends registration payments on Fees, block a team circuit-wide, or remove one application before viewing starts.",
      },
      {
        title: "Open judging",
        body: "Verify the competition's OneLegends fee and each team's $25 registration before opening viewing. Unpaid, blocked, or removed applications stay off the roster. Once applications are closed and at least one judge is approved, open judging; the app freezes the anonymous viewing order.",
      },
      {
        title: "Monitor and export",
        body: "Follow live scoring progress, help manage the judge panel, validate results when every active judge submits, and download CSV or XLSX reports for permitted operations. Keep exports private because they may contain emails and rosters.",
      },
    ],
    cta: { href: "/login", label: "Log in" },
    signedInCta: { href: "/dashboard", label: "Open dashboard" },
  },
];

export function RoleGuide({
  signedIn,
  standalone,
  teamVideoUrl,
  compVideoUrl,
}: {
  signedIn?: boolean;
  standalone?: boolean;
  teamVideoUrl?: string;
  compVideoUrl?: string;
}) {
  const [activeId, setActiveId] = useState<GuideId>(compVideoUrl && !teamVideoUrl ? "COMP" : "TEAM");
  const Heading = standalone ? "h1" : "h2";
  const GuideHeading = standalone ? "h2" : "h3";
  const VideoHeading = standalone ? "h2" : "h3";
  const index = GUIDES.findIndex((g) => g.id === activeId);
  const guide = GUIDES[index] ?? GUIDES[0];
  const videos = [
    teamVideoUrl ? { url: teamVideoUrl, title: "Team tutorial video" } : null,
    compVideoUrl ? { url: compVideoUrl, title: "Competition tutorial video" } : null,
  ].filter((video): video is { url: string; title: string } => video !== null);

  function go(delta: number) {
    const next = (index + delta + GUIDES.length) % GUIDES.length;
    setActiveId(GUIDES[next].id);
  }

  const cta = standalone && signedIn
    ? { href: "/dashboard", label: "Your dashboard" }
    : signedIn && guide.signedInCta ? guide.signedInCta : guide.cta;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <Heading className="font-heading text-2xl tracking-[0.12em]">
        How it works
      </Heading>

      {videos.length > 0 ? (
        <div className={`mx-auto mt-6 grid gap-8 ${videos.length === 1 ? "max-w-3xl" : "md:grid-cols-2"}`}>
          {videos.map((video) => (
            <div key={video.title}>
              <VideoHeading className="mb-3 text-center font-heading text-lg tracking-[0.08em]">
                {video.title}
              </VideoHeading>
              <DriveAvPlayer url={video.url} label={video.title} />
            </div>
          ))}
        </div>
      ) : null}

      <p className="mb-5 mt-6 max-w-2xl text-muted">
        Accounts use Google sign-in. Teams and competitions use claim codes,
        while judges and moderators receive access by email. Choose a role
        below for its steps.
      </p>

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
