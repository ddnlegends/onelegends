import { setActiveCompAction } from "@/app/actions/team-access";
import { InstantSelect } from "@/components/InstantSelect";

export function CompSwitcher({
  competitions,
  activeId,
  alwaysShow = false,
}: {
  competitions: { id: string; name: string }[];
  activeId: string;
  alwaysShow?: boolean;
}) {
  if (competitions.length === 0) return null;
  if (competitions.length < 2 && !alwaysShow) return null;
  return (
    <form action={setActiveCompAction} className="flex flex-wrap items-end gap-3">
      <div className="field">
        <label htmlFor="active-comp">Active competition</label>
        <InstantSelect
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
        </InstantSelect>
      </div>
      <button className="btn btn-ghost" type="submit">
        Switch
      </button>
    </form>
  );
}
