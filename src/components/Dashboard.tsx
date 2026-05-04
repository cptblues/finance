import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  computeMerchantGroups,
  computeDailyPoints,
  computeExpenseCategories,
  computeInsights,
  computeMonthlyBenchmarks,
  computeMonthlySummary,
  computeStats,
  getDefaultDashboardMonth,
  filterTransactionsByMerchantPeriod
} from "../lib/analysis";
import { formatCurrency } from "../lib/format";
import type { MerchantPeriod, Transaction } from "../lib/types";
import { ArrowDown, ArrowUp, ChartNoAxesCombined, ChevronRight, PiggyBank, WalletCards } from "lucide-react";

const categoryColors = ["#6faa84", "#a7c79a", "#8fb7cf", "#f0c56d", "#b8a0d7", "#a7a29a", "#ded7cd", "#d98b72"];

export function Dashboard({ transactions, selectedMonth }: { transactions: Transaction[]; selectedMonth?: string | null }) {
  const [merchantPeriod, setMerchantPeriod] = useState<MerchantPeriod>("month");
  const activeMonth = selectedMonth ?? getDefaultDashboardMonth(transactions);
  const activeTransactions = activeMonth ? transactions.filter((transaction) => transaction.date?.startsWith(activeMonth)) : transactions;
  const merchantTransactions = filterTransactionsByMerchantPeriod(transactions, merchantPeriod, activeMonth);
  const summary = activeMonth ? computeMonthlySummary(transactions, activeMonth) : null;
  const benchmarks = activeMonth ? computeMonthlyBenchmarks(transactions, activeMonth) : null;
  const stats = summary ?? computeStats(activeTransactions);
  const daily = computeDailyPoints(activeTransactions);
  const categories = computeExpenseCategories(activeTransactions).slice(0, 8);
  const merchants = computeMerchantGroups(merchantTransactions);
  const insights = computeInsights(transactions, activeMonth);
  const savingsRate = summary?.savingsRate ?? null;

  return (
    <section className="dashboard">
      <div className="chart-title">
        <h2>{summary ? `Synthese ${summary.label}` : "Synthese financiere"}</h2>
        <strong>{summary ? `${summary.transactionCount} operation(s)` : `${stats.transactionCount} operation(s)`}</strong>
      </div>
      <div className="stats-grid">
        <StatCard
          label="Solde net"
          value={formatCurrency(stats.net)}
          detail={benchmarks?.previousMonth ? `${formatSignedCurrency(benchmarks.previousMonth.netDelta)} vs mois precedent` : `${stats.transactionCount} operations`}
          tone={stats.net >= 0 ? "positive" : "negative"}
          icon={<ChartNoAxesCombined size={22} />}
        />
        <StatCard
          label="Depenses du mois"
          value={formatCurrency(stats.expenses)}
          detail={benchmarks?.previousMonth ? `${formatSignedCurrency(benchmarks.previousMonth.expensesDelta)} vs mois precedent` : `${formatCurrency(stats.averageExpense)} en moyenne`}
          tone="negative"
          icon={<ArrowDown size={22} />}
        />
        <StatCard
          label="Revenus du mois"
          value={formatCurrency(stats.income)}
          detail={benchmarks?.previousMonth ? `${formatSignedCurrency(benchmarks.previousMonth.incomeDelta)} vs mois precedent` : `${formatCurrency(stats.averageIncome)} en moyenne`}
          tone="positive"
          icon={<ArrowUp size={22} />}
        />
        <StatCard
          label="Taux d'epargne"
          value={formatSavingsRate(savingsRate)}
          detail={benchmarks?.average3Months ? `${formatCurrency(benchmarks.average3Months.net)} net moyen 3 mois` : `${formatCurrency(stats.net)} de capacite`}
          tone={stats.net >= 0 ? "positive" : "negative"}
          icon={<PiggyBank size={22} />}
        />
      </div>

      <div className="chart-grid">
        <article className="panel chart-panel chart-panel-large">
          <PanelHeader title="Revenus vs Depenses" />
          <div className="chart-body-centered">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={daily}>
                <CartesianGrid stroke="#ece7df" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Legend iconType="rect" />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="income" name="Revenus" fill="#6faa84" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expenses" name="Depenses" fill="#d8c8b1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel">
          <PanelHeader title="Depenses par categorie" detail={stats.expenses > 0 ? formatCurrency(stats.expenses) : undefined} />
          {categories.length > 0 ? (
            <div className="category-analysis">
              <div className="donut-layout">
                <ResponsiveContainer width="42%" height={220}>
                  <PieChart>
                    <Pie data={categories} dataKey="value" nameKey="name" innerRadius={56} outerRadius={86} paddingAngle={2}>
                      {categories.map((entry, index) => (
                        <Cell key={entry.name} fill={categoryColors[index % categoryColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="58%" height={220}>
                  <BarChart data={categories} layout="vertical" margin={{ left: 8, right: 12 }}>
                    <CartesianGrid stroke="#ece7df" horizontal={false} />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value" name="Depenses" radius={[0, 4, 4, 0]}>
                      {categories.map((category, index) => (
                        <Cell key={category.name} fill={categoryColors[index % categoryColors.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="category-legend">
                {categories.map((category, index) => (
                  <CategoryRow key={category.name} category={category} index={index} totalExpenses={stats.expenses} />
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">Aucune depense detectee dans la selection.</div>
          )}
        </article>

        <article className="panel chart-panel chart-panel-large">
          <PanelHeader title="Evolution du solde net" />
          <div className="chart-body-centered">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={daily}>
                <defs>
                  <linearGradient id="netFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#6faa84" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#6faa84" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ece7df" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value, name) => [formatCurrency(Number(value)), name === "balance" ? "Solde cumule" : String(name)]} />
                <Line type="monotone" dataKey="balance" name="Solde cumule" stroke="#6faa84" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel chart-panel insights-panel">
          <PanelHeader title="Analyses & insights" />
          <div className="insight-list">
            {insights.length > 0 ? (
              insights.map((insight) => (
                <div key={insight.title} className="insight-row">
                  <span className={`insight-icon ${insight.tone}`}>
                    <WalletCards size={16} />
                  </span>
                  <span>
                    <strong>{insight.title}</strong>
                    <small>{insight.description}</small>
                  </span>
                  <ChevronRight size={16} />
                </div>
              ))
            ) : (
              <div className="empty-state">Importe un CSV pour obtenir des insights.</div>
            )}
          </div>
        </article>

        <article className="panel chart-panel merchant-panel">
          <div className="chart-title">
            <h3>Top marchands</h3>
            <select value={merchantPeriod} onChange={(event) => setMerchantPeriod(event.target.value as MerchantPeriod)}>
              <option value="month">Mois</option>
              <option value="quarter">3 mois</option>
              <option value="year">Annee</option>
            </select>
          </div>
          <div className="merchant-list">
            {merchants.length > 0 ? (
              merchants.map((merchant) => (
                <div key={merchant.normalizedLabel} className="merchant-row">
                  <span>{merchant.label}</span>
                  <strong>{formatCurrency(merchant.total)}</strong>
                  <small>{merchant.count} operation(s)</small>
                </div>
              ))
            ) : (
              <div className="empty-state">Aucune depense dans la selection.</div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function CategoryRow({
  category,
  index,
  totalExpenses
}: {
  category: { name: string; value: number; count?: number };
  index: number;
  totalExpenses: number;
}) {
  const share = totalExpenses > 0 ? (category.value / totalExpenses) * 100 : 0;

  return (
    <div className="category-row">
      <span className="legend-dot" style={{ background: categoryColors[index % categoryColors.length] }} />
      <span>{category.name}</span>
      <strong>{share.toFixed(1)} %</strong>
      <small>{category.count ?? 0}</small>
      <em>{formatCurrency(category.value)}</em>
    </div>
  );
}

function PanelHeader({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="chart-title">
      <h3>{title}</h3>
      {detail ? <strong>{detail}</strong> : null}
    </div>
  );
}

function formatSavingsRate(value: number | null) {
  return value === null ? "N/A" : `${(value * 100).toFixed(1)} %`;
}

function formatSignedCurrency(value: number) {
  return `${value >= 0 ? "+" : ""}${formatCurrency(value)}`;
}

function StatCard({
  label,
  value,
  detail,
  tone,
  icon
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative";
  icon: ReactNode;
}) {
  return (
    <article className="stat-card">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small className={tone}>{detail}</small>
      </div>
      <span className={`stat-icon ${tone ?? "neutral"}`}>{icon}</span>
    </article>
  );
}
