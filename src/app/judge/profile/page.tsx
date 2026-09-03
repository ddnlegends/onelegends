import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { JudgeProfileForm } from "@/components/JudgeProfileForm";

export default async function JudgeProfilePage() {
  const session = await auth();
  const judge = await prisma.judgeProfile.findUnique({
    where: { userId: session!.user.id },
    include: { user: { select: { email: true } } },
  });
  if (!judge) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-4xl">Judge Profile</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Name, phone, and the email on this account. Competitions see this when
          they approve access.
        </p>
      </div>
      <JudgeProfileForm
        email={judge.user.email}
        profile={{ name: judge.name, phone: judge.phone }}
      />
    </div>
  );
}
