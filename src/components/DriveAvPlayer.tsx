import { parseDriveUrl, drivePreviewSrc, driveViewUrl } from "@/lib/drive";

export function DriveAvPlayer({
  url,
  label,
  scoringHint = false,
}: {
  url: string;
  label: string;
  scoringHint?: boolean;
}) {
  const parsed = parseDriveUrl(url);
  const note = scoringHint
    ? " Leave a comment below for the competition."
    : "";

  if (!url.trim()) {
    return (
      <div className="rounded-xl border border-line bg-blush p-6 text-sm text-muted">
        No audition video is on file for this team.{note}
      </div>
    );
  }

  if (parsed?.kind === "file") {
    return (
      <div className="space-y-2">
        <iframe
          title={label}
          src={drivePreviewSrc(parsed.id)}
          className="aspect-video w-full rounded-xl border border-line bg-black"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
        <p className="text-xs text-muted">
          In-site Google Drive player.{" "}
          <a
            href={driveViewUrl(parsed)}
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            Open In Drive
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-blush p-6 text-sm">
      <p className="text-ink">
        This AV is a folder or unrecognized Drive link, so it cannot play inline
        without showing file names.{note}
      </p>
      <a
        href={url}
        className="mt-3 inline-flex text-accent underline"
        target="_blank"
        rel="noreferrer"
      >
        Open AV In Google Drive
      </a>
    </div>
  );
}
