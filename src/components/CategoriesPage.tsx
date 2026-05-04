import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { computeCategorySummaries, transactionCategory } from "../lib/analysis";
import { formatCurrency } from "../lib/format";
import type { Transaction } from "../lib/types";
import { TransactionsTable } from "./TransactionsTable";

type Props = {
  transactions: Transaction[];
  userCategories: string[];
  categorySuggestions?: string[];
  onUpdateTransaction: (fingerprint: string, patch: Partial<Transaction>) => Promise<void>;
  onDeleteUserCategory: (category: string) => Promise<void>;
};

export function CategoriesPage({
  transactions,
  userCategories,
  categorySuggestions = userCategories,
  onUpdateTransaction,
  onDeleteUserCategory
}: Props) {
  const summaries = useMemo(() => computeCategorySummaries(transactions), [transactions]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(summaries[0]?.name ?? null);
  const selected = selectedCategory ?? summaries[0]?.name ?? null;
  const userCategorySet = useMemo(() => new Set(userCategories), [userCategories]);
  const categoryTransactions = selected
    ? transactions.filter((transaction) => transactionCategory(transaction) === selected)
    : [];

  useEffect(() => {
    if (selectedCategory && !summaries.some((summary) => summary.name === selectedCategory)) {
      setSelectedCategory(summaries[0]?.name ?? null);
    }
  }, [selectedCategory, summaries]);

  return (
    <section className="categories-page">
      <div className="categories-grid">
        <section className="panel categories-list-panel">
          <div className="chart-title">
            <h2>Categories detectees</h2>
            <strong>{summaries.length}</strong>
          </div>
          <div className="categories-list">
            {summaries.map((category) => {
              const canDelete = userCategorySet.has(category.name);

              return (
                <div key={category.name} className={`category-summary-row ${selected === category.name ? "active" : ""}`}>
                  <button className="category-summary-main" type="button" onClick={() => setSelectedCategory(category.name)}>
                    <span>
                      <strong>{category.name}</strong>
                      <small>{category.transactionCount} operation(s)</small>
                    </span>
                    <span>
                      <strong>{formatCurrency(category.expenses)}</strong>
                      <small>{category.expenseShare.toFixed(1)} %</small>
                    </span>
                  </button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="action danger"
                      title="Supprimer la categorie personnalisee"
                      onClick={() => void onDeleteUserCategory(category.name)}
                    >
                      <Trash2 size={15} />
                    </button>
                  ) : null}
                </div>
              );
            })}
            {summaries.length === 0 ? <div className="empty-state">Aucune categorie detectee.</div> : null}
          </div>
        </section>

        <section className="panel category-detail-panel">
          <div className="chart-title">
            <h2>{selected ?? "Categorie"}</h2>
            <strong>{categoryTransactions.length} transaction(s)</strong>
          </div>
          {selected ? (
            <div className="category-kpis">
              <Metric label="Depenses" value={formatCurrency(summaries.find((summary) => summary.name === selected)?.expenses ?? 0)} tone="negative" />
              <Metric label="Revenus" value={formatCurrency(summaries.find((summary) => summary.name === selected)?.income ?? 0)} tone="positive" />
              <Metric label="Solde" value={formatCurrency(summaries.find((summary) => summary.name === selected)?.net ?? 0)} />
            </div>
          ) : null}
          <TransactionsTable
            transactions={categoryTransactions}
            userCategories={userCategories}
            categorySuggestions={categorySuggestions}
            onUpdateTransaction={onUpdateTransaction}
            variant="full"
            initialPageSize={25}
          />
        </section>
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
