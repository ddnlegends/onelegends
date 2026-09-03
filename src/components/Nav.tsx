import Link from "next/link";
import { auth } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { SignOutButton } from "@/components/SignOutButton";

export async function Nav() {
  const session = await auth();
  const role = session?.user?.role;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <BrandMark href="/" />
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium tracking-wide">
          <Link href="/" className="text-muted hover:text-accent">
            Home
          </Link>
          {role === "TEAM" ? (
            <>
              <Link href="/teams" className="text-muted hover:text-accent">
                Teams
              </Link>
              <Link href="/team/profile" className="text-muted hover:text-accent">
                Team Profile
              </Link>
              <Link href="/team/apply" className="font-semibold text-accent">
                Apply
              </Link>
            </>
          ) : null}
          {role === "COMP" ? (
            <>
              <Link href="/comp" className="text-muted hover:text-accent">
                Application Stats
              </Link>
              <Link href="/comp/judges" className="text-muted hover:text-accent">
                Judges
              </Link>
              <Link href="/comp/results" className="font-semibold text-accent">
                Viewing Results
              </Link>
              <Link href="/comp/profile" className="text-muted hover:text-accent">
                Comp Details
              </Link>
            </>
          ) : null}
          {role === "JUDGE" ? (
            <>
              <Link href="/judge" className="font-semibold text-accent">
                Judging
              </Link>
              <Link href="/judge/profile" className="text-muted hover:text-accent">
                Judge Profile
              </Link>
            </>
          ) : null}
          {session ? (
            <SignOutButton />
          ) : (
            <>
              <Link href="/login" className="text-muted hover:text-accent">
                Log In
              </Link>
              <Link href="/register" className="btn btn-primary py-1.5">
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
