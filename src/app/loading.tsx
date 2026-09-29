import { PageSkeleton } from "@/components/PageSkeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageSkeleton />
    </div>
  );
}
