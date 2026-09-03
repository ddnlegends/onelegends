"use client";

import { useState } from "react";
import Link from "next/link";
import type { Role } from "@prisma/client";

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
    kicker: "One profile · many comps",
    title: "How teams apply",
    intro:
      "You build one team profile, then check every competition you want. Payment stays off this site.",
    steps: [
      {
        title: "Register as a team",
        body: "Create a Team account with email, password, and your team name. This is not a competition or judge login — pick Team on the register screen.",
      },
      {
        title: "Fill Team Profile",
        body: "Every field is required: blurb, captains, wiki, photo, years established, roster size, and a Drive file AV. You cannot apply until this is saved.",
      },
      {
        title: "Add the dancer roster",
        body: "List each dancer with a t-shirt size. Dietary notes are optional if there are none. Mark who is in the AV. At least one dancer is required to apply.",
      },
      {
        title: "Paste one AV Drive link",
        body: "Use a Google Drive file link (not a folder) and share it so anyone with the link can view. That same video is sent to every comp you check. Folder links cannot play in the judge packet.",
      },
      {
        title: "Apply with checkboxes",
        body: "Apply stays locked until the profile and roster are complete. Then check the competitions you want and submit once. Each listing has its own deadline. Late apps are locked unless that competition extends the date.",
      },
    ],
    cta: { href: "/register?role=TEAM", label: "Register a team" },
    signedInCta: { href: "/team/apply", label: "Go to Apply" },
  },
  {
    id: "JUDGE",
    tab: "Judges",
    kicker: "Blind packets · no names",
    title: "How judges score",
    intro:
      "You never see team names. Each judge gets a shuffled Team 1…K packet and scores the same rubric.",
    steps: [
      {
        title: "Register as a judge",
        body: "Create a Judge account, then fill Judge Profile with your name and phone. Competitions use that to know who requested access.",
      },
      {
        title: "Request the comps you will judge",
        body: "Nothing is automatic. Open Judging, pick competitions, and send a request. Wait until that competition Approves you. Denied requests stay off your to-do list.",
      },
      {
        title: "Wait until applications close",
        body: "Your packet is built the first time you open it after that competition’s apps are closed. If they later extend the deadline, judges who already opened a packet keep their snapshot.",
      },
      {
        title: "Score Team 1, Team 2, …",
        body: "Watch the AV and score 0–10 for choreography, formations, technique, sync & cleanliness, and overall impression (50 total). Your Team 1 is not another judge’s Team 1. Jump between teams like an exam — scores save as you go.",
      },
      {
        title: "Submit Judging when every slot is filled",
        body: "Submit locks your packet. You will not see rankings, other judges’ scores, or team names. After N judges submit, only the competition login sees named results.",
      },
    ],
    cta: { href: "/register?role=JUDGE", label: "Register as a judge" },
    signedInCta: { href: "/judge", label: "Open Judging" },
  },
  {
    id: "COMP",
    tab: "Competitions",
    kicker: "Claim a listing · then reveal",
    title: "How competitions run apps",
    intro:
      "Listings already appear on Home. You claim yours with a bid code. You see counts until anonymous judging is done.",
    steps: [
      {
        title: "Register with your claim code",
        body: "On Register, choose Competition and enter the official bid code (one code, one listing, one account). Teams already see the name on the public list. First valid claim wins.",
      },
      {
        title: "Set Comp Details",
        body: "Dates, city, venue, stage, lighting, production notes, application deadline, and required judge count (N). The competition name stays locked to the official listing. Optionally paste a Google Sheet URL for applicant export.",
      },
      {
        title: "Watch stats, not names",
        body: "Application Stats shows volume and aggregates only. You do not see which teams applied until viewing is complete. Payment is handled off this site.",
      },
      {
        title: "Approve judges",
        body: "Judges request access. Open Judges and Approve or Deny each person. They cannot open a packet until you approve. You can lower N later if fewer judges finish than you planned.",
      },
      {
        title: "Release Viewing Results",
        body: "When N approved judges have submitted, ranked names unlock: scores, z-scores, AVs, and accept / waitlist / decline. Judges still cannot see that table. Until then, even you do not get the named list.",
      },
    ],
    cta: { href: "/register?role=COMP", label: "Claim a competition" },
    signedInCta: { href: "/comp", label: "Application Stats" },
  },
];

export function RoleGuide({ sessionRole }: { sessionRole?: Role }) {
  const initial =
    sessionRole === "JUDGE" || sessionRole === "COMP" || sessionRole === "TEAM"
      ? sessionRole
      : "TEAM";
  const [activeId, setActiveId] = useState<GuideId>(initial);
  const index = GUIDES.findIndex((g) => g.id === activeId);
  const guide = GUIDES[index] ?? GUIDES[0];

  function go(delta: number) {
    const next = (index + delta + GUIDES.length) % GUIDES.length;
    setActiveId(GUIDES[next].id);
  }

  const cta =
    sessionRole === guide.id && guide.signedInCta
      ? guide.signedInCta
      : guide.cta;

  return (
    <section className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-2xl tracking-[0.12em]">
            How it works
          </h2>
          <p className="mt-2 max-w-xl text-muted">
            Three roles, three walkthroughs. Pick the one that is you.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_12px_40px_rgba(142,28,66,0.06)]">
        <div
          role="tablist"
          aria-label="Choose a role"
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
