import { X } from "lucide-react";
import { defaultFilters, getActiveFilterChips } from "../lib/analysis";
import type { ActiveFilterChip, DashboardFilters } from "../lib/types";

type Props = {
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
};

export function ActiveFilters({ filters, onChange }: Props) {
  const chips = getActiveFilterChips(filters);
  if (chips.length === 0) return null;

  function remove(chip: ActiveFilterChip) {
    if (chip.key === "dateRange") {
      onChange({ ...filters, startDate: "", endDate: "" });
      return;
    }
    onChange({ ...filters, [chip.key]: defaultFilters[chip.key as keyof DashboardFilters] });
  }

  return (
    <section className="active-filters">
      {chips.map((chip) => (
        <button key={`${chip.key}-${chip.label}`} type="button" onClick={() => remove(chip)}>
          <span>{chip.label}</span>
          <X size={13} />
        </button>
      ))}
      <button className="reset-filters" type="button" onClick={() => onChange(defaultFilters)}>
        Reinitialiser
      </button>
    </section>
  );
}
