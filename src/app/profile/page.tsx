import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  ChangePasswordForm,
  ProfileDetailsForm,
} from "@/components/ProfileForms";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, passwordHash: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-4xl">Profile</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Update the name, email, and password on this login. Team Profile and
          Comp Details stay on their own pages.
        </p>
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <ProfileDetailsForm name={user.name} email={user.email} />
        {user.passwordHash ? (
          <ChangePasswordForm />
        ) : (
          <div className="space-y-4 rounded-xl border border-line bg-card p-6">
            <h2 className="font-heading text-xl">Password</h2>
            <p className="text-sm text-muted">
              This login uses Google. There is no password on file.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
