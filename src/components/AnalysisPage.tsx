import { useMemo, useState } from "react";
import { computeCalendarSummary, computeEnhancedMonthAnalysis, detectBankFees, getAvailableMonths } from "../lib/analysis";
import { formatCurrency, formatDate } from "../lib/format";
import type { Transaction } from "../lib/types";

export function AnalysisPage({ transactions }: { transactions: Transaction[] }) {
  const months = getAvailableMonths(transactions);
  const [firstMonth, setFirstMonth] = useState(months[1]?.value ?? months[0]?.value ?? "");
  const [secondMonth, setSecondMonth] = useState(months[0]?.value ?? "");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const analysis = useMemo(
    () => (firstMonth && secondMonth ? computeEnhancedMonthAnalysis(transactions, firstMonth, secondMonth) : null),
    [transactions, firstMonth, secondMonth]
  );
  const calendarDays = useMemo(() => (secondMonth ? computeCalendarSummary(transactions, secondMonth) : []), [transactions, secondMonth]);
  const selectedDaySummary = calendarDays.find((day) => day.date === (selectedDay ?? calendarDays.find((day) => day.transactions.length > 0)?.date));
  const bankFees = useMemo(() => detectBankFees(transactions).filter((fee) => !secondMonth || fee.transaction.date?.startsWith(secondMonth)), [transactions, secondMonth]);

  return (
    <section className="analysis-page">
      <div className="panel analysis-controls">
        <h2>Comparer deux mois</h2>
        <select value={firstMonth} onChange={(event) => setFirstMonth(event.target.value)}>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
        <select value={secondMonth} onChange={(event) => setSecondMonth(event.target.value)}>
          {months.map((month) => (
            <option key={month.value} value={month.value}>
              {month.label}
            </option>
          ))}
        </select>
      </div>
      {analysis ? (
        <>
          <div className="stats-grid">
            <Metric label="Depenses A" value={formatCurrency(analysis.comparison.firstStats.expenses)} />
            <Metric label="Depenses B" value={formatCurrency(analysis.comparison.secondStats.expenses)} />
            <Metric label="Revenus B" value={formatCurrency(analysis.comparison.secondStats.income)} />
            <Metric label="Ecart depenses" value={formatCurrency(analysis.comparison.secondStats.expenses - analysis.comparison.firstStats.expenses)} />
            <Metric label="Ecart solde" value={formatCurrency(analysis.comparison.secondStats.net - analysis.comparison.firstStats.net)} />
            <Metric label="Taux epargne B" value={formatSavingsRate(analysis.comparison.secondStats)} />
          </div>
          <section className="panel analysis-table-panel">
            <div className="chart-title">
              <h2>Categories en variation</h2>
              <strong>{analysis.significantCategoryDeltas.length} hausse(s) forte(s)</strong>
            </div>
            {analysis.comparison.categoryDeltas.length > 0 ? (
              <div className="comparison-table">
                <div className="comparison-row comparison-header">
                  <span>Categorie</span>
                  <span>Mois A</span>
                  <span>Mois B</span>
                  <span>Ecart</span>
                  <span>Variation</span>
                </div>
                {analysis.comparison.categoryDeltas.map((category) => (
                  <div key={category.name} className="comparison-row">
                    <strong>{category.name}</strong>
                    <span>{formatCurrency(category.firstAmount)}</span>
                    <span>{formatCurrency(category.secondAmount)}</span>
                    <span className={category.delta >= 0 ? "negative" : "positive"}>{formatCurrency(category.delta)}</span>
                    <span>{category.percentChange === null ? "-" : `${category.percentChange.toFixed(1)} %`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">Aucune variation de categorie pour cette comparaison.</div>
            )}
          </section>
          <div className="analysis-grid">
            <section className="panel analysis-table-panel analysis-calendar-panel">
              <div className="chart-title">
                <h2>Calendrier des flux</h2>
                <strong>{secondMonth}</strong>
              </div>
              <div className="calendar-grid">
                {calendarDays.map((day) => (
                  <button
                    key={day.date}
                    type="button"
                    className={`calendar-day ${selectedDaySummary?.date === day.date ? "active" : ""} ${day.isHighExpenseDay ? "high-expense" : ""}`}
                    onClick={() => setSelectedDay(day.date)}
                  >
                    <strong>{day.day}</strong>
                    <span className={day.net >= 0 ? "positive" : "negative"}>{day.transactions.length > 0 ? formatCurrency(day.net) : ""}</span>
                    {day.hasRecurring ? <small>Rec.</small> : null}
                  </button>
                ))}
              </div>
              {selectedDaySummary ? (
                <div className="day-detail">
                  <div className="chart-title">
                    <h3>{formatDate(selectedDaySummary.date)}</h3>
                    <strong>{selectedDaySummary.transactions.length} operation(s)</strong>
                  </div>
                  <div className="analysis-list">
                    {selectedDaySummary.transactions.length > 0 ? (
                      selectedDaySummary.transactions.map((transaction) => (
                        <div key={transaction.fingerprint} className="analysis-row">
                          <strong>{transaction.label}</strong>
                          <span className={transaction.amount >= 0 ? "positive" : "negative"}>{formatCurrency(transaction.amount)}</span>
                          <small>{transaction.userCategory || transaction.bankCategory || transaction.operationType || "-"}</small>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">Aucune operation ce jour.</div>
                    )}
                  </div>
                </div>
              ) : null}
            </section>

            <section className="panel analysis-table-panel">
              <div className="chart-title">
                <h2>Frais bancaires detectes</h2>
                <strong>{bankFees.length}</strong>
              </div>
              <div className="analysis-list">
                {bankFees.length > 0 ? (
                  bankFees.map((fee) => (
                    <div key={fee.transaction.fingerprint} className="analysis-row">
                      <strong>{fee.transaction.label}</strong>
                      <span className="negative">{formatCurrency(fee.amount)}</span>
                      <small>
                        {formatDate(fee.transaction.date)} - {fee.feeType} via "{fee.keyword}"
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Aucun frais bancaire explicite detecte.</div>
                )}
              </div>
            </section>

            <section className="panel analysis-table-panel">
              <div className="chart-title">
                <h2>Depenses inhabituelles</h2>
                <strong>{analysis.unusualExpenses.length}</strong>
              </div>
              <div className="analysis-list">
                {analysis.unusualExpenses.length > 0 ? (
                  analysis.unusualExpenses.map((anomaly) => (
                    <div key={anomaly.id} className="analysis-row">
                      <strong>{anomaly.transaction.label}</strong>
                      <span>{formatCurrency(Math.abs(anomaly.transaction.amount))}</span>
                      <small>{anomaly.reason}</small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Aucune depense inhabituelle detectee.</div>
                )}
              </div>
            </section>

            <section className="panel analysis-table-panel">
              <div className="chart-title">
                <h2>Revenus recurrents</h2>
                <strong>{analysis.recurringIncomes.length}</strong>
              </div>
              <div className="analysis-list">
                {analysis.recurringIncomes.length > 0 ? (
                  analysis.recurringIncomes.slice(0, 6).map((income) => (
                    <div key={income.id} className="analysis-row">
                      <strong>{income.label}</strong>
                      <span>{formatCurrency(income.stability.averageIncome)}</span>
                      <small>
                        {income.months.length} mois, {income.stability.status === "stable" ? "stable" : "variable"}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Aucun revenu recurrent detecte.</div>
                )}
              </div>
            </section>

            <section className="panel analysis-table-panel">
              <div className="chart-title">
                <h2>Marchands nouveaux</h2>
                <strong>{analysis.newMerchants.length}</strong>
              </div>
              <div className="analysis-list">
                {analysis.newMerchants.length > 0 ? (
                  analysis.newMerchants.map((merchant) => (
                    <div key={merchant.normalizedLabel} className="analysis-row">
                      <strong>{merchant.label}</strong>
                      <span>{formatCurrency(merchant.total)}</span>
                      <small>{merchant.count} operation(s)</small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Aucun nouveau marchand.</div>
                )}
              </div>
            </section>

            <section className="panel analysis-table-panel">
              <div className="chart-title">
                <h2>Marchands disparus</h2>
                <strong>{analysis.goneMerchants.length}</strong>
              </div>
              <div className="analysis-list">
                {analysis.goneMerchants.length > 0 ? (
                  analysis.goneMerchants.map((merchant) => (
                    <div key={merchant.normalizedLabel} className="analysis-row">
                      <strong>{merchant.label}</strong>
                      <span>{formatCurrency(merchant.total)}</span>
                      <small>{merchant.count} operation(s)</small>
                    </div>
                  ))
                ) : (
                  <div className="empty-state">Aucun marchand disparu.</div>
                )}
              </div>
            </section>
          </div>
        </>
      ) : (
        <div className="panel empty-state">Il faut au moins un mois importe.</div>
      )}
    </section>
  );
}

function formatSavingsRate(stats: { income: number; net: number }) {
  return stats.income > 0 ? `${((stats.net / stats.income) * 100).toFixed(1)} %` : "N/A";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </article>
  );
}
