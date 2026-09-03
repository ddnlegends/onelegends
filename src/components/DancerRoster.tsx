"use client";

import { useActionState, useState } from "react";
import { saveDancers } from "@/app/actions/team";
import { TSHIRT_SIZES } from "@/lib/utils";

type Dancer = {
  name: string;
  dietaryRestrictions: string;
  tshirtSize: string;
  inAV: boolean;
};

const emptyDancer = (): Dancer => ({
  name: "",
  dietaryRestrictions: "",
  tshirtSize: "",
  inAV: false,
});

export function DancerRoster({ initial }: { initial: Dancer[] }) {
  const [dancers, setDancers] = useState<Dancer[]>(
    initial.length ? initial : [emptyDancer()],
  );
  const [state, formAction, pending] = useActionState(saveDancers, undefined);

  function update(index: number, patch: Partial<Dancer>) {
    setDancers((current) =>
      current.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-xl border border-line bg-card p-6">
      <input type="hidden" name="dancersJson" value={JSON.stringify(dancers)} />
      <p className="text-sm text-muted">
        At least one dancer with a name and t-shirt size is required before you
        can apply. Dietary notes can be left blank if there are none.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="pb-2 font-medium">Name</th>
              <th className="pb-2 font-medium">Dietary restrictions</th>
              <th className="pb-2 font-medium">T-shirt</th>
              <th className="pb-2 font-medium">In AV</th>
              <th className="pb-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {dancers.map((dancer, index) => (
              <tr key={index} className="border-t border-line">
                <td className="py-2 pr-2">
                  <input
                    className="w-full rounded-md border border-line px-2 py-1.5"
                    value={dancer.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    placeholder="Dancer name"
                  />
                </td>
                <td className="py-2 pr-2">
                  <input
                    className="w-full rounded-md border border-line px-2 py-1.5"
                    value={dancer.dietaryRestrictions}
                    onChange={(e) =>
                      update(index, { dietaryRestrictions: e.target.value })
                    }
                    placeholder="Vegetarian, nut allergy…"
                  />
                </td>
                <td className="py-2 pr-2">
                  <select
                    className="w-full rounded-md border border-line px-2 py-1.5"
                    value={dancer.tshirtSize}
                    onChange={(e) => update(index, { tshirtSize: e.target.value })}
                  >
                    <option value="">—</option>
                    {TSHIRT_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 pr-2">
                  <input
                    type="checkbox"
                    checked={dancer.inAV}
                    onChange={(e) => update(index, { inAV: e.target.checked })}
                  />
                </td>
                <td className="py-2">
                  <button
                    type="button"
                    className="text-muted hover:text-ink"
                    onClick={() =>
                      setDancers((current) => current.filter((_, i) => i !== index))
                    }
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setDancers((current) => [...current, emptyDancer()])}
        >
          Add dancer
        </button>
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending ? "Saving…" : "Save roster"}
        </button>
      </div>
      {state?.error ? <p className="notice notice-error">{state.error}</p> : null}
      {state?.ok ? <p className="notice notice-ok">Roster saved. Roster count updated.</p> : null}
    </form>
  );
}
