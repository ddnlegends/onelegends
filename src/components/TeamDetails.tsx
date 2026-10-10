import { DriveAvPlayer } from "@/components/DriveAvPlayer";
import { TeamPhoto } from "@/components/TeamPhoto";

export type DetailedTeam = {
  name: string;
  claimedAt: Date | null;
  photoUrl: string;
  blurb: string;
  wikiUrl: string;
  avDriveUrl: string;
  captains: string;
  yearsEstablished: number | null;
  rosterSize: number | null;
  dancers: Array<{
    id: string;
    name: string;
    dietaryRestrictions: string;
    tshirtSize: string;
    inAV: boolean;
    pointOfContact: boolean;
    soberMonitor: boolean;
  }>;
};

export function TeamDetails({
  team,
  hideHeading = false,
}: {
  team: DetailedTeam;
  hideHeading?: boolean;
}) {
  const wikiUrl = /^https?:\/\//i.test(team.wikiUrl) ? team.wikiUrl : "";
  return (
    <div className="space-y-8">
      <section
        className={`rounded-xl border border-line bg-card p-6 ${
          team.claimedAt ? "grid gap-6 sm:grid-cols-[12rem_1fr]" : ""
        }`}
      >
        {team.claimedAt ? (
          <TeamPhoto src={team.photoUrl} name={team.name} size="wide" />
        ) : null}
        <div>
          {hideHeading ? null : <h1 className="font-heading text-3xl">{team.name}</h1>}
          {team.blurb ? (
            <p className={`${hideHeading ? "" : "mt-2 "}text-muted`}>{team.blurb}</p>
          ) : null}
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">Captains</dt><dd>{team.captains || "—"}</dd></div>
            <div><dt className="text-muted">Years established</dt><dd>{team.yearsEstablished ?? "—"}</dd></div>
            <div><dt className="text-muted">Roster size</dt><dd>{team.rosterSize ?? team.dancers.length}</dd></div>
            <div><dt className="text-muted">AV dancers</dt><dd>{team.dancers.filter((d) => d.inAV).map((d) => d.name).join(", ") || "—"}</dd></div>
          </dl>
          {wikiUrl ? (
            <a href={wikiUrl} target="_blank" rel="noreferrer" className="mt-4 inline-block text-sm text-accent underline">
              Team wiki
            </a>
          ) : null}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Audition video</h2>
        <DriveAvPlayer url={team.avDriveUrl} label={`${team.name} audition video`} />
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-2xl">Full roster</h2>
        {team.dancers.length === 0 ? (
          <p className="text-muted">No dancers have been added yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-line bg-card">
            <table className="w-full min-w-[54rem] text-left text-sm">
              <thead className="border-b border-line bg-blush text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Dancer</th>
                  <th className="px-4 py-3 font-medium">In AV</th>
                  <th className="px-4 py-3 font-medium">Point of Contact</th>
                  <th className="px-4 py-3 font-medium">Sober Monitor</th>
                  <th className="px-4 py-3 font-medium">Shirt size</th>
                  <th className="px-4 py-3 font-medium">Dietary restrictions</th>
                </tr>
              </thead>
              <tbody>
                {team.dancers.map((dancer) => (
                  <tr key={dancer.id} className="border-b border-line last:border-0">
                    <th className="px-4 py-3 font-medium">{dancer.name}</th>
                    <td className="px-4 py-3">{dancer.inAV ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{dancer.pointOfContact ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{dancer.soberMonitor ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">{dancer.tshirtSize || "—"}</td>
                    <td className="px-4 py-3">{dancer.dietaryRestrictions || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
