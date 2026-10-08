import Link from "next/link";
import { auth } from "@/auth";
import { BrandMark } from "@/components/BrandMark";
import { NavLink } from "@/components/NavLink";
import { SignOutButton } from "@/components/SignOutButton";
import { getNavAccess } from "@/lib/team-access";

export async function Nav() {
  const session = await auth();
  const userId = session?.user?.id;
  const access = userId ? await getNavAccess(userId) : null;
  const ops = access?.ops ?? false;
  const teamAccess = access?.teamAccess ?? false;
  const compAccess = access?.compAccess ?? false;
  const judgeAccess = access?.judgeAccess ?? false;
  const homeHref = session ? "/dashboard" : "/";

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 lg:pr-36">
        <div className="mr-32 lg:mr-0">
          <BrandMark href={homeHref} />
        </div>
        <nav className="order-3 flex w-full flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium tracking-wide lg:order-none lg:w-auto lg:flex-1 lg:justify-end">
          {session ? (
            <NavLink href="/dashboard">Dashboard</NavLink>
          ) : (
            <NavLink href="/">Home</NavLink>
          )}
          {session ? <NavLink href="/profile">Profile</NavLink> : null}
          <NavLink href="/payments">Payments</NavLink>
          {teamAccess ? (
            <NavLink href="/team/profile" match="prefix">
              Team Profile
            </NavLink>
          ) : null}
          {compAccess && !ops ? (
            <NavLink href="/comp/profile" match="prefix">
              Comp Details
            </NavLink>
          ) : null}
          {ops ? (
            <NavLink href="/ops/comps" match="prefix">
              Comp Dashboard
            </NavLink>
          ) : null}
          {ops ? <NavLink href="/ops/teams" match="prefix">Teams</NavLink> : null}
          {ops ? (
            <NavLink href="/ops/competitions" match="prefix">
              Competitions
            </NavLink>
          ) : null}
          {judgeAccess ? (
            <NavLink href="/judge" match="prefix">
              Judging
            </NavLink>
          ) : null}
          {session && !ops ? (
            <NavLink href="/claim">Code Claim</NavLink>
          ) : null}
          {session ? (
            <SignOutButton />
          ) : (
            <>
              <NavLink href="/login">Log In</NavLink>
              <Link href="/register" className="btn btn-primary py-1.5">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
