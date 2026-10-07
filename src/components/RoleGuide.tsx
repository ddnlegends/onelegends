"use client";

import { useState } from "react";
import Link from "next/link";

type GuideId = "TEAM" | "JUDGE" | "COMP";

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
      "Everyone signs in with Google. Existing test accounts retain password login. Circuit ops creates the team listing and a claim code. The first person to enter that code becomes the primary admin. Payment stays off this site.",
    steps: [
      {
        title: "Register once",
        body: "Sign in with Google. That does not create a team. After you log in, you land on your dashboard. Open Code Claim with the team code.",
      },
      {
        title: "Claim the team with the code",
        body: "Only Legends Admin can create a team. Creating one generates a claim code. The app does not email anyone — ops gives you the code. First successful claim becomes primary admin and uses the code up. If it is already claimed, you will see that plus a blurred admin email (first two letters of the local part).",
      },
      {
        title: "Invite secondary admins by email",
        body: "Only the primary admin can invite more admins. Type their email. If they already have an account, they get a popup the next time they log in. If they do not, they get the same popup after they register. Clicking outside does not dismiss it. It also stays under Requests on your dashboard until they Approve. There is no “that’s not me” button that kills the invite.",
      },
      {
        title: "Fill Team Profile and roster",
        body: "Every field is required: blurb, captains, uploaded team photo, years established, roster size, and a Drive file AV. List each dancer with a t-shirt size. You cannot apply until this is saved.",
      },
      {
        title: "Apply with checkboxes",
        body: "Apply stays locked until the profile and roster are complete. Then check the competitions you want and submit once. Each listing has its own deadline.",
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
      "Judges are invited by email from a competition. There is no judge claim code. You never see team names. Each judge gets a private shuffled packet and watches the Drive AV on their own laptop.",
    steps: [
      {
        title: "Register or log in",
        body: "Same login as everyone else. You do not pick “Judge” on the form.",
      },
      {
        title: "Approve the invite",
        body: "A competition types your email in-app. This site does not send real email. The next time you log in (or right after you register), a popup asks you to Approve. It also stays under Requests on your dashboard until you do.",
      },
      {
        title: "Wait until applications close",
        body: "Judging starts after applications close and circuit ops opens judging. Packets shuffle once after that. If a team later fixes a Drive link, refresh your packet to see the update.",
      },
      {
        title: "Score Team 1, Team 2, …",
        body: "Score 0–10 for choreography, formations, technique, sync & cleanliness, and overall impression (50 total). Watch the Drive AV on your laptop and jump between teams. Leave an optional comment for the competition; other judges will not see it.",
      },
      {
        title: "Submit Judging when every slot is filled",
        body: "Save as you go. Submit locks your packet. You will not see rankings, other judges’ scores, or team names. If judging is closed, you cannot change scores until circuit ops opens it again. After N judges submit, only the competition login sees named results.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/dashboard", label: "Your dashboard" },
  },
  {
    id: "COMP",
    tab: "Competitions",
    kicker: "Partner code · then invite",
    title: "How competitions run apps",
    intro:
      "Everyone signs in with Google. Existing test accounts retain password login. Circuit ops creates the competition listing and a partner code. The first person to enter that code becomes the primary admin. You see counts until anonymous judging is done.",
    steps: [
      {
        title: "Register, then claim with the partner code",
        body: "Only Legends Admin can create a competition. Creating one generates a partner code. The app does not email anyone — ops gives you the code. First successful claim becomes primary admin and uses the code up. If it is already claimed, you will see that plus a blurred admin email.",
      },
      {
        title: "Invite secondary admins",
        body: "Only the primary admin can invite more competition admins by email. Same popup-on-login pattern as teams. Requests on your dashboard hold anything not yet approved.",
      },
      {
        title: "Set Comp Details",
        body: "Dates, city, venue, stage, lighting, production notes, application deadline, and required judge count (N). The competition name stays locked to the official listing.",
      },
      {
        title: "Invite judges by email",
        body: "Type a judge’s email. This app does not send mail — they approve in the popup / Account until they click Approve.",
      },
      {
        title: "Release Viewing Results",
        body: "When N invited judges have submitted, ranked names unlock: scores, z-scores, judge comments, live AVs, and accept / waitlist / decline. Judges still cannot see that table. Until then, even you do not get the named list. Circuit ops can open judging, then use Live View for every subscore as judges autosave.",
      },
    ],
    cta: { href: "/register", label: "Create an account" },
    signedInCta: { href: "/claim", label: "Code Claim" },
  },
];

export function RoleGuide({ signedIn }: { signedIn?: boolean }) {
  const [activeId, setActiveId] = useState<GuideId>("TEAM");
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
          <h2 className="font-heading text-2xl tracking-[0.12em]">
            How it works
          </h2>
          <p className="mt-2 max-w-2xl text-muted">
            One login for everyone. Teams and competitions are claimed with a
            code. Judges are invited by email. You can be on a team and a
            competition at the same time.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_rgba(142,28,66,0.06)]">
        <div
          role="tablist"
          aria-label="Choose a walkthrough"
          className="grid grid-cols-3 border-b border-line bg-blush"
        >
          {GUIDES.map((item) => {
            const selected = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={selected}
                id={`guide-tab-${item.id}`}
                aria-controls={`guide-panel-${item.id}`}
                onClick={() => setActiveId(item.id)}
                className={`relative px-3 py-3.5 text-center text-xs font-bold uppercase tracking-[0.14em] transition sm:text-sm ${
                  selected
                    ? "bg-white text-accent"
                    : "text-muted hover:bg-white/60 hover:text-ink"
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
          <h3 className="mt-2 font-heading text-xl tracking-[0.08em] sm:text-2xl">
            {guide.title}
          </h3>
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
