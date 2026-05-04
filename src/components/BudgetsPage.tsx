import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { computeBudgetProgress, computeEndOfMonthProjection, getDefaultDashboardMonth } from "../lib/analysis";
import { formatCurrency } from "../lib/format";
import type { Budget, Transaction } from "../lib/types";

type Props = {
  transactions: Transaction[];
  budgets: Budget[];
  categorySuggestions: string[];
  selectedMonth: string | null;
  onCreateBudget: (category: string, monthlyAmount: number) => Promise<void>;
  onUpdateBudget: (id: string, patch: Partial<Budget>) => Promise<void>;
  onDeleteBudget: (id: string) => Promise<void>;
};

export function BudgetsPage({
  transactions,
  budgets,
  categorySuggestions,
  selectedMonth,
  onCreateBudget,
  onUpdateBudget,
  onDeleteBudget
}: Props) {
  const activeMonth = selectedMonth ?? getDefaultDashboardMonth(transactions) ?? "";
  const [category, setCategory] = useState(categorySuggestions[0] ?? "");
  const [amount, setAmount] = useState("");
  const progress = useMemo(() => computeBudgetProgress(transactions, budgets, activeMonth), [transactions, budgets, activeMonth]);
  const projections = useMemo(() => computeEndOfMonthProjection(transactions, budgets, activeMonth), [transactions, budgets, activeMonth]);
  const totalBudget = progress.reduce((sum, item) => sum + item.budget.monthlyAmount, 0);
  const totalSpent = progress.reduce((sum, item) => sum + item.spent, 0);
  const totalProjected = projections.reduce((sum, item) => sum + item.projectedSpent, 0);

  async function submit() {
    const monthlyAmount = Number(amount.replace(",", "."));
    if (!category.trim() || !Number.isFinite(monthlyAmount) || monthlyAmount <= 0) return;
    await onCreateBudget(category.trim(), monthlyAmount);
    setAmount("");
  }

  return (
    <section className="budgets-page">
      <div className="recurring-summary-grid">
        <Metric label="Budget mensuel" value={formatCurrency(totalBudget)} />
        <Metric label="Depense" value={formatCurrency(totalSpent)} tone={totalSpent > totalBudget ? "negative" : undefined} />
        <Metric label="Reste" value={formatCurrency(totalBudget - totalSpent)} tone={totalBudget - totalSpent < 0 ? "negative" : "positive"} />
        <Metric label="Projection" value={formatCurrency(totalProjected)} tone={totalProjected > totalBudget ? "negative" : undefined} />
      </div>

      <section className="panel budget-editor-panel">
        <div className="chart-title">
          <h2>Budgets par categorie</h2>
          <strong>{activeMonth || "Aucun mois"}</strong>
        </div>
        <div className="budget-form">
          <input list="budget-categories" value={category} placeholder="Categorie" onChange={(event) => setCategory(event.target.value)} />
          <input inputMode="decimal" value={amount} placeholder="Montant mensuel" onChange={(event) => setAmount(event.target.value)} />
          <button className="primary-button" type="button" onClick={() => void submit()}>
            <Plus size={16} />
            Ajouter
          </button>
        </div>
        <datalist id="budget-categories">
          {categorySuggestions.map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>

        {progress.length > 0 ? (
          <div className="budget-list">
            {progress.map((item) => {
              const projection = projections.find((candidate) => candidate.budget.id === item.budget.id);
              return (
                <div key={item.budget.id} className="budget-row">
                  <div className="budget-row-main">
                    <strong>{item.category}</strong>
                    <small>
                      {item.transactionCount} operation(s), projection {formatCurrency(projection?.projectedSpent ?? item.spent)}
                    </small>
                  </div>
                  <div className="budget-progress">
                    <span style={{ width: `${Math.min(item.progress, 1) * 100}%` }} />
                  </div>
                  <span>{formatCurrency(item.spent)}</span>
                  <span>{formatCurrency(item.budget.monthlyAmount)}</span>
                  <strong className={item.remaining < 0 ? "negative" : "positive"}>{formatCurrency(item.remaining)}</strong>
                  <input
                    inputMode="decimal"
                    value={item.budget.monthlyAmount}
                    aria-label={`Budget ${item.category}`}
                    onChange={(event) => {
                      const nextAmount = Number(event.target.value);
                      if (Number.isFinite(nextAmount) && nextAmount >= 0) {
                        void onUpdateBudget(item.budget.id, { monthlyAmount: nextAmount });
                      }
                    }}
                  />
                  <button className="action danger" type="button" title="Supprimer le budget" onClick={() => void onDeleteBudget(item.budget.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">Ajoute un budget pour suivre tes categories mensuelles.</div>
        )}
      </section>
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
