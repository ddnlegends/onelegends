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
    <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <BrandMark href={homeHref} />
        <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium tracking-wide">
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
              <Link href="/register" prefetch className="btn btn-primary py-1.5">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
