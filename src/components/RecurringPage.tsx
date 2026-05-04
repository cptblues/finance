import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { computeRecurringExpenseMetrics, detectRecurringExpenses } from "../lib/analysis";
import { formatCurrency, formatDate } from "../lib/format";
import type { RecurringExpense, RecurringExpenseMetrics, Transaction } from "../lib/types";

type Props = {
  transactions: Transaction[];
  userCategories: string[];
  categorySuggestions?: string[];
  onUpdateTransaction: (fingerprint: string, patch: Partial<Transaction>) => Promise<void>;
  onUpdateTransactions: (fingerprints: string[], patch: Partial<Transaction>) => Promise<void>;
};

type RecurringRow = {
  recurrence: RecurringExpense;
  metrics: RecurringExpenseMetrics;
};

export function RecurringPage({ transactions, onUpdateTransactions }: Props) {
  const rows = useMemo<RecurringRow[]>(
    () =>
      detectRecurringExpenses(transactions).map((recurrence) => ({
        recurrence,
        metrics: computeRecurringExpenseMetrics(recurrence)
      })),
    [transactions]
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (rows.find((row) => row.recurrence.id === selectedId) ?? null) : null;
  const monthlyEstimate = rows.reduce((sum, row) => sum + row.recurrence.averageAmount, 0);
  const annualEstimate = rows.reduce((sum, row) => sum + row.metrics.annualEstimate, 0);
  const occurrenceCount = rows.reduce((sum, row) => sum + row.metrics.occurrenceCount, 0);
  const fixedExpenseCount = rows.filter((row) => row.metrics.regularityRate >= 0.9 && row.metrics.expectedMonthCount >= 2).length;

  useEffect(() => {
    if (!selectedId || rows.some((row) => row.recurrence.id === selectedId)) return;
    setSelectedId(null);
  }, [rows, selectedId]);

  function toggleRecurrence(recurrence: RecurringExpense) {
    return onUpdateTransactions(
      recurrence.transactions.map((transaction) => transaction.fingerprint),
      recurrence.status === "manual"
        ? { recurrenceStatus: null, recurrenceId: null }
        : { recurrenceStatus: "ignored", recurrenceId: null }
    );
  }

  return (
    <section className="recurring-page">
      <div className="recurring-summary-grid">
        <Metric label="Mensuel estime" value={formatCurrency(monthlyEstimate)} />
        <Metric label="Annuel estime" value={formatCurrency(annualEstimate)} />
        <Metric label="Depenses fixes" value={fixedExpenseCount.toString()} />
        <Metric label="Occurrences" value={occurrenceCount.toString()} />
      </div>

      <section className="panel recurring-table-panel">
        <div className="chart-title">
          <h2>Operations recurrentes mensuelles</h2>
          <strong>{rows.length}</strong>
        </div>
        {rows.length > 0 ? (
          <div className="recurring-table">
            <div className="recurring-row recurring-header">
              <span>Operation</span>
              <span>Categorie</span>
              <span>Statut</span>
              <span>Moyenne</span>
              <span>Jour</span>
              <span>Variation</span>
              <span>Annuel</span>
              <span>Regularite</span>
              <span>Dernier passage</span>
              <span />
            </div>
            {rows.map((row) => (
              <div
                key={row.recurrence.id}
                role="button"
                tabIndex={0}
                className={`recurring-row recurring-data-row ${selected?.recurrence.id === row.recurrence.id ? "active" : ""}`}
                onClick={() => setSelectedId(row.recurrence.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedId(row.recurrence.id);
                }}
              >
                <strong>{row.recurrence.label}</strong>
                <span>{row.metrics.category}</span>
                <span>{row.recurrence.status === "manual" ? "Manuel" : "Detecte"}</span>
                <span>{formatCurrency(row.metrics.monthlyEstimate)}</span>
                <span>{formatAverageDay(row.metrics.averageDayOfMonth)}</span>
                <span>{formatPercent(row.metrics.amountVariation)}</span>
                <span>{formatCurrency(row.metrics.annualEstimate)}</span>
                <span>
                  {row.metrics.monthCount}/{row.metrics.expectedMonthCount} mois
                  {row.metrics.missingMonths.length > 0 ? <em className="missing-months">-{row.metrics.missingMonths.length}</em> : null}
                </span>
                <span>{formatDate(row.metrics.lastDate)}</span>
                <span>
                  <button
                    type="button"
                    className="filter-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleRecurrence(row.recurrence);
                    }}
                  >
                    {row.recurrence.status === "manual" ? "Retirer" : "Desactiver"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Aucune recurrence detectee.</div>
        )}
      </section>

      {selected ? (
        <RecurringDrawer
          row={selected}
          onClose={() => setSelectedId(null)}
          onToggle={() => void toggleRecurrence(selected.recurrence)}
        />
      ) : null}
    </section>
  );
}

function RecurringDrawer({ row, onClose, onToggle }: { row: RecurringRow; onClose: () => void; onToggle: () => void }) {
  const [simulationAmount, setSimulationAmount] = useState(row.recurrence.averageAmount.toFixed(2));
  const simulatedMonthly = Number(simulationAmount.replace(",", "."));
  const simulatedAnnualDelta = Number.isFinite(simulatedMonthly)
    ? (row.recurrence.averageAmount - simulatedMonthly) * 12
    : null;

  useEffect(() => {
    setSimulationAmount(row.recurrence.averageAmount.toFixed(2));
  }, [row.recurrence.id, row.recurrence.averageAmount]);

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <aside className="transaction-drawer recurring-drawer">
        <div className="drawer-header">
          <div>
            <h2>{row.recurrence.label}</h2>
            <p>
              Present {row.metrics.monthCount} mois sur {row.metrics.expectedMonthCount}
              {row.metrics.missingMonths.length > 0 ? `, ${row.metrics.missingMonths.length} mois manquant(s)` : ""}
            </p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="category-kpis">
          <Metric label="Min" value={formatCurrency(row.metrics.minAmount)} />
          <Metric label="Moyenne" value={formatCurrency(row.recurrence.averageAmount)} />
          <Metric label="Max" value={formatCurrency(row.metrics.maxAmount)} />
        </div>
        <div className="category-kpis">
          <Metric label="Jour moyen" value={formatAverageDay(row.metrics.averageDayOfMonth)} />
          <Metric label="Regularite" value={formatPercent(row.metrics.regularityRate)} />
          <Metric label="Projection an." value={formatCurrency(row.metrics.annualEstimate)} />
        </div>

        <div className="recurring-month-timeline" aria-label="Historique mensuel">
          {row.metrics.monthlyHistory.map((month) => (
            <div key={month.month} className={`recurring-month ${month.status}`} title={month.status === "present" ? formatCurrency(month.totalAmount) : "Absent"}>
              <span>{month.label}</span>
              <strong>{month.status === "present" ? formatCurrency(month.totalAmount) : "-"}</strong>
            </div>
          ))}
        </div>

        <label className="drawer-field">
          <span>Simulation montant mensuel</span>
          <input
            className="table-input"
            inputMode="decimal"
            value={simulationAmount}
            onChange={(event) => setSimulationAmount(event.target.value)}
          />
        </label>
        <div className="simulation-result">
          <span>Ecart annuel estime</span>
          <strong className={simulatedAnnualDelta !== null && simulatedAnnualDelta >= 0 ? "positive" : "negative"}>
            {simulatedAnnualDelta === null ? "-" : formatCurrency(simulatedAnnualDelta)}
          </strong>
        </div>

        <div className="drawer-actions">
          <button type="button" className="filter-button" onClick={onToggle}>
            {row.recurrence.status === "manual" ? "Retirer cette recurrence" : "Desactiver cette recurrence"}
          </button>
        </div>

        <div className="recurring-history">
          <div className="recurring-history-row recurring-history-header">
            <span>Date</span>
            <span>Libelle</span>
            <span>Categorie</span>
            <span>Montant</span>
          </div>
          {[...row.recurrence.transactions]
            .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
            .map((transaction) => (
              <div key={transaction.fingerprint} className="recurring-history-row">
                <span>{formatDate(transaction.date)}</span>
                <strong>{transaction.label}</strong>
                <span>{transaction.userCategory || transaction.bankCategory || "-"}</span>
                <strong className="negative">{formatCurrency(transaction.amount)}</strong>
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatAverageDay(value: number | null) {
  return value === null ? "-" : `J${Math.round(value)}`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)} %`;
}
