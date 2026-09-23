import { setActiveCompAction } from "@/app/actions/team-access";

export function CompSwitcher({
  competitions,
  activeId,
}: {
  competitions: { id: string; name: string }[];
  activeId: string;
}) {
  if (competitions.length < 2) return null;
  return (
    <form action={setActiveCompAction} className="flex flex-wrap items-end gap-3">
      <div className="field">
        <label htmlFor="active-comp">Active competition</label>
        <select
          key={activeId}
          id="active-comp"
          name="competitionId"
          defaultValue={activeId}
        >
          {competitions.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-ghost" type="submit">
        Switch
      </button>
    </form>
  );
}
