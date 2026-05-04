import { CalendarDays, SlidersHorizontal } from "lucide-react";
import { getAvailableMonths, uniqueOptions } from "../lib/analysis";
import type { DashboardFilters, Transaction } from "../lib/types";

type Props = {
  transactions: Transaction[];
  filters: DashboardFilters;
  onChange: (filters: DashboardFilters) => void;
};

export function FilterBar({ transactions, filters, onChange }: Props) {
  const categories = uniqueOptions(transactions, (transaction) => transaction.userCategory || transaction.bankCategory);
  const subcategories = uniqueOptions(transactions, (transaction) => transaction.bankSubcategory);
  const operationTypes = uniqueOptions(transactions, (transaction) => transaction.operationType);
  const months = getAvailableMonths(transactions);
  const selectedMonth = months.find((month) => month.startDate === filters.startDate && month.endDate === filters.endDate)?.value ?? "";

  function patch(next: Partial<DashboardFilters>) {
    onChange({ ...filters, ...next });
  }

  return (
    <section className="filters">
      <select
        value={selectedMonth}
        onChange={(event) => {
          const month = months.find((item) => item.value === event.target.value);
          patch(month ? { startDate: month.startDate, endDate: month.endDate } : { startDate: "", endDate: "" });
        }}
      >
        <option value="">Tous les mois</option>
        {months.map((month) => (
          <option key={month.value} value={month.value}>
            {month.label}
          </option>
        ))}
      </select>
      <label className="compact-date">
        <CalendarDays size={15} />
        <input type="date" value={filters.startDate} onChange={(event) => patch({ startDate: event.target.value })} />
      </label>
      <label className="compact-date">
        <CalendarDays size={15} />
        <input type="date" value={filters.endDate} onChange={(event) => patch({ endDate: event.target.value })} />
      </label>
      <select value={filters.flow} onChange={(event) => patch({ flow: event.target.value as DashboardFilters["flow"] })}>
        <option value="all">Tous les flux</option>
        <option value="expense">Depenses</option>
        <option value="income">Revenus</option>
      </select>
      <select value={filters.category} onChange={(event) => patch({ category: event.target.value })}>
        <option value="">Toutes categories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <select value={filters.subcategory} onChange={(event) => patch({ subcategory: event.target.value })}>
        <option value="">Toutes sous-categories</option>
        {subcategories.map((subcategory) => (
          <option key={subcategory} value={subcategory}>
            {subcategory}
          </option>
        ))}
      </select>
      <select value={filters.operationType} onChange={(event) => patch({ operationType: event.target.value })}>
        <option value="">Tous types</option>
        {operationTypes.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
      <button className="filter-button" type="button" aria-label="Filtres avances">
        <SlidersHorizontal size={15} />
        <span>Filtres</span>
      </button>
      <label className="checkbox-label" title="Inclure les transactions exclues des statistiques">
        <input
          type="checkbox"
          checked={filters.includeExcluded}
          onChange={(event) => patch({ includeExcluded: event.target.checked })}
        />
        Exclus
      </label>
    </section>
  );
}
