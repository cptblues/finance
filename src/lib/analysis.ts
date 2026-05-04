import { addDays, addMonths, differenceInCalendarDays, endOfMonth, format, isAfter, isBefore, parseISO, startOfMonth, subMonths } from "date-fns";
import type {
  CategoryPoint,
  CategorySummary,
  ActiveFilterChip,
  BankFeeDetection,
  Budget,
  BudgetProgress,
  CalendarDaySummary,
  DailyPoint,
  DashboardFilters,
  DashboardStats,
  EnhancedMonthAnalysis,
  EndOfMonthProjection,
  ExpenseAnomaly,
  FinanceInsight,
  IncomeStability,
  MerchantGroup,
  MerchantPoint,
  MerchantPeriod,
  MonthlyReportData,
  MonthlyBenchmarks,
  MonthlyComparison,
  MonthComparison,
  MonthComparisonCategory,
  MonthlyPoint,
  MonthlySummary,
  RecurringExpense,
  RecurringExpenseMetrics,
  RecurringIncome,
  Transaction
} from "./types";

const unusualExpenseMultiplier = 2;
const unusualExpenseMinimumHistory = 3;
const significantCategoryIncreasePercent = 50;
const significantCategoryDeltaMinimumAmount = 50;
const recurringIncomeMinimumMonths = 2;
const stableIncomeRelativeVariation = 0.15;
const highExpenseDayMultiplier = 1.5;

export const defaultFilters: DashboardFilters = {
  search: "",
  startDate: "",
  endDate: "",
  category: "",
  subcategory: "",
  operationType: "",
  flow: "all",
  minAmount: "",
  maxAmount: "",
  includeExcluded: false
};

export function transactionCategory(transaction: Transaction) {
  return transaction.userCategory || transaction.bankCategory || "Sans categorie";
}

export function parseValidIsoDate(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = parseISO(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getAvailableMonths(transactions: Transaction[]): { value: string; label: string; startDate: string; endDate: string }[] {
  const months = new Map<string, { value: string; label: string; startDate: string; endDate: string }>();

  for (const transaction of transactions) {
    const date = parseValidIsoDate(transaction.date);
    if (!date) continue;
    const value = format(startOfMonth(date), "yyyy-MM");
    months.set(value, {
      value,
      label: new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date),
      startDate: format(startOfMonth(date), "yyyy-MM-dd"),
      endDate: format(endOfMonth(date), "yyyy-MM-dd")
    });
  }

  return Array.from(months.values()).sort((a, b) => b.value.localeCompare(a.value));
}

export function applyFilters(transactions: Transaction[], filters: DashboardFilters): Transaction[] {
  const search = filters.search.trim().toLowerCase();
  const minAmount = filters.minAmount ? Number(filters.minAmount) : null;
  const maxAmount = filters.maxAmount ? Number(filters.maxAmount) : null;

  return transactions.filter((transaction) => {
    if (!filters.includeExcluded && transaction.isExcludedFromStats) return false;
    if (search && !`${transaction.label} ${transaction.rawLabel ?? ""} ${transaction.notes ?? ""}`.toLowerCase().includes(search)) return false;
    if (filters.category && transactionCategory(transaction) !== filters.category) return false;
    if (filters.subcategory && transaction.bankSubcategory !== filters.subcategory) return false;
    if (filters.operationType && transaction.operationType !== filters.operationType) return false;
    if (filters.flow === "income" && transaction.amount <= 0) return false;
    if (filters.flow === "expense" && transaction.amount >= 0) return false;
    if (minAmount !== null && Number.isFinite(minAmount) && transaction.amount < minAmount) return false;
    if (maxAmount !== null && Number.isFinite(maxAmount) && transaction.amount > maxAmount) return false;

    const date = parseValidIsoDate(transaction.date);
    if (date) {
      const startDate = parseValidIsoDate(filters.startDate);
      const endDate = parseValidIsoDate(filters.endDate);
      if (startDate && isBefore(date, startDate)) return false;
      if (endDate && isAfter(date, endDate)) return false;
    } else if (filters.startDate || filters.endDate) {
      return false;
    }

    return true;
  });
}

export function computeStats(transactions: Transaction[]): DashboardStats {
  const incomeTransactions = transactions.filter((transaction) => transaction.amount > 0);
  const expenseTransactions = transactions.filter((transaction) => transaction.amount < 0);
  const income = incomeTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const expenses = expenseTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

  return {
    income,
    expenses,
    net: income - expenses,
    transactionCount: transactions.length,
    averageExpense: expenseTransactions.length > 0 ? expenses / expenseTransactions.length : 0,
    averageIncome: incomeTransactions.length > 0 ? income / incomeTransactions.length : 0,
    largestExpense: [...expenseTransactions].sort((a, b) => a.amount - b.amount)[0] ?? null,
    largestIncome: [...incomeTransactions].sort((a, b) => b.amount - a.amount)[0] ?? null
  };
}

function monthLabel(month: string) {
  const date = parseValidIsoDate(`${month}-01`);
  if (!date) return month;
  return new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(date);
}

function emptyMonthlySummary(month: string): MonthlySummary {
  return {
    month,
    label: monthLabel(month),
    income: 0,
    expenses: 0,
    net: 0,
    transactionCount: 0,
    averageExpense: 0,
    averageIncome: 0,
    savingsRate: null
  };
}

function monthlySummaryFromTransactions(month: string, transactions: Transaction[]): MonthlySummary {
  const stats = computeStats(transactions);

  return {
    month,
    label: monthLabel(month),
    income: stats.income,
    expenses: stats.expenses,
    net: stats.net,
    transactionCount: stats.transactionCount,
    averageExpense: stats.averageExpense,
    averageIncome: stats.averageIncome,
    savingsRate: stats.income > 0 ? stats.net / stats.income : null
  };
}

function averageMonthlySummary(month: string, summaries: MonthlySummary[]): MonthlySummary | null {
  if (summaries.length === 0) return null;
  const totals = summaries.reduce(
    (acc, summary) => ({
      income: acc.income + summary.income,
      expenses: acc.expenses + summary.expenses,
      net: acc.net + summary.net,
      transactionCount: acc.transactionCount + summary.transactionCount,
      averageExpense: acc.averageExpense + summary.averageExpense,
      averageIncome: acc.averageIncome + summary.averageIncome
    }),
    { income: 0, expenses: 0, net: 0, transactionCount: 0, averageExpense: 0, averageIncome: 0 }
  );
  const count = summaries.length;
  const income = totals.income / count;
  const net = totals.net / count;

  return {
    month,
    label: `${count} mois`,
    income,
    expenses: totals.expenses / count,
    net,
    transactionCount: Math.round(totals.transactionCount / count),
    averageExpense: totals.averageExpense / count,
    averageIncome: totals.averageIncome / count,
    savingsRate: income > 0 ? net / income : null
  };
}

export function getDefaultDashboardMonth(transactions: Transaction[]): string | null {
  return computeMonthlyTrend(transactions).at(-1)?.month ?? null;
}

export function computeMonthlySummary(transactions: Transaction[], month: string): MonthlySummary {
  if (!/^\d{4}-\d{2}$/.test(month)) return emptyMonthlySummary(month);
  return monthlySummaryFromTransactions(
    month,
    transactions.filter((transaction) => transaction.date?.startsWith(month))
  );
}

export function computeMonthlyTrend(transactions: Transaction[]): MonthlySummary[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    const date = parseValidIsoDate(transaction.date);
    if (!date) continue;
    const month = format(startOfMonth(date), "yyyy-MM");
    groups.set(month, [...(groups.get(month) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .map(([month, monthlyTransactions]) => monthlySummaryFromTransactions(month, monthlyTransactions))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function computeMonthlyBenchmarks(transactions: Transaction[], month: string): MonthlyBenchmarks {
  const trend = computeMonthlyTrend(transactions);
  const activeSummary = computeMonthlySummary(transactions, month);
  const activeIndex = trend.findIndex((summary) => summary.month === month);
  const previousCalendarMonth = parseValidIsoDate(`${month}-01`)
    ? format(addDays(startOfMonth(parseISO(`${month}-01`)), -1), "yyyy-MM")
    : "";
  const previousSummary = trend.find((summary) => summary.month === previousCalendarMonth) ?? null;
  const previousMonths = activeIndex > -1 ? trend.slice(0, activeIndex) : trend.filter((summary) => summary.month < month);
  const savingsRateDelta =
    previousSummary?.savingsRate !== null && previousSummary?.savingsRate !== undefined && activeSummary.savingsRate !== null
      ? activeSummary.savingsRate - previousSummary.savingsRate
      : null;
  const previousMonth: MonthlyComparison | null = previousSummary
    ? {
        month: previousSummary.month,
        summary: previousSummary,
        incomeDelta: activeSummary.income - previousSummary.income,
        expensesDelta: activeSummary.expenses - previousSummary.expenses,
        netDelta: activeSummary.net - previousSummary.net,
        savingsRateDelta
      }
    : null;

  return {
    activeMonth: month,
    previousMonth,
    average3Months: averageMonthlySummary("average-3", previousMonths.slice(-3)),
    average6Months: averageMonthlySummary("average-6", previousMonths.slice(-6)),
    bestMonth: trend.length > 0 ? [...trend].sort((a, b) => b.net - a.net)[0] : null,
    worstMonth: trend.length > 0 ? [...trend].sort((a, b) => a.net - b.net)[0] : null
  };
}

export function computeMonthlyPoints(transactions: Transaction[]): MonthlyPoint[] {
  const points = new Map<string, MonthlyPoint>();

  for (const transaction of transactions) {
    const date = parseValidIsoDate(transaction.date);
    if (!date) continue;
    const month = format(startOfMonth(date), "yyyy-MM");
    const point = points.get(month) ?? { month, income: 0, expenses: 0, net: 0 };

    if (transaction.amount > 0) point.income += transaction.amount;
    if (transaction.amount < 0) point.expenses += Math.abs(transaction.amount);
    point.net += transaction.amount;
    points.set(month, point);
  }

  return Array.from(points.values()).sort((a, b) => a.month.localeCompare(b.month));
}

export function computeDailyPoints(transactions: Transaction[]): DailyPoint[] {
  const datedTransactions = transactions
    .map((transaction) => ({ transaction, date: parseValidIsoDate(transaction.date) }))
    .filter((entry): entry is { transaction: Transaction; date: Date } => Boolean(entry.date))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  if (datedTransactions.length === 0) return [];

  const start = datedTransactions[0].date;
  const end = datedTransactions[datedTransactions.length - 1].date;
  const byDate = new Map<string, DailyPoint>();

  for (let offset = 0; offset <= differenceInCalendarDays(end, start); offset += 1) {
    const date = addDays(start, offset);
    const key = format(date, "yyyy-MM-dd");
    byDate.set(key, {
      date: key,
      label: format(date, "dd/MM"),
      income: 0,
      expenses: 0,
      net: 0,
      balance: 0
    });
  }

  for (const { transaction, date } of datedTransactions) {
    const key = format(date, "yyyy-MM-dd");
    const point = byDate.get(key);
    if (!point) continue;
    if (transaction.amount > 0) point.income += transaction.amount;
    if (transaction.amount < 0) point.expenses += Math.abs(transaction.amount);
    point.net += transaction.amount;
  }

  let balance = 0;
  return Array.from(byDate.values()).map((point) => {
    balance += point.net;
    return { ...point, balance };
  });
}

export function computeExpenseCategories(transactions: Transaction[]): CategoryPoint[] {
  const totals = new Map<string, { value: number; count: number }>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const category = transactionCategory(transaction);
    if (category.toLowerCase() === "transaction exclue") continue;
    const existing = totals.get(category) ?? { value: 0, count: 0 };
    existing.value += Math.abs(transaction.amount);
    existing.count += 1;
    totals.set(category, existing);
  }

  return Array.from(totals.entries())
    .map(([name, total]) => ({ name, value: total.value, count: total.count }))
    .sort((a, b) => b.value - a.value);
}

export function computeCategorySummaries(transactions: Transaction[]): CategorySummary[] {
  const totalExpenses = transactions.reduce((sum, transaction) => (transaction.amount < 0 ? sum + Math.abs(transaction.amount) : sum), 0);
  const summaries = new Map<string, CategorySummary>();

  for (const transaction of transactions) {
    const name = transactionCategory(transaction);
    const existing = summaries.get(name) ?? {
      name,
      bankCategory: transaction.bankCategory,
      userCategory: transaction.userCategory,
      transactionCount: 0,
      income: 0,
      expenses: 0,
      net: 0,
      expenseShare: 0
    };

    existing.transactionCount += 1;
    if (transaction.amount > 0) existing.income += transaction.amount;
    if (transaction.amount < 0) existing.expenses += Math.abs(transaction.amount);
    existing.net += transaction.amount;
    existing.expenseShare = totalExpenses > 0 ? (existing.expenses / totalExpenses) * 100 : 0;
    summaries.set(name, existing);
  }

  return Array.from(summaries.values()).sort((a, b) => b.expenses - a.expenses);
}

export function computeBudgetProgress(transactions: Transaction[], budgets: Budget[], month: string): BudgetProgress[] {
  return budgets
    .map((budget) => {
      const budgetTransactions = transactions.filter(
        (transaction) => transaction.amount < 0 && transaction.date?.startsWith(month) && transactionCategory(transaction) === budget.category
      );
      const spent = budgetTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
      const remaining = budget.monthlyAmount - spent;

      return {
        budget,
        category: budget.category,
        spent,
        remaining,
        overage: Math.max(0, spent - budget.monthlyAmount),
        progress: budget.monthlyAmount > 0 ? spent / budget.monthlyAmount : 0,
        transactionCount: budgetTransactions.length
      };
    })
    .sort((a, b) => b.progress - a.progress || b.spent - a.spent);
}

function projectionDay(month: string, today: Date) {
  const monthStart = parseValidIsoDate(`${month}-01`);
  if (!monthStart) return { dayOfMonth: 1, daysInMonth: 1 };
  const daysInMonth = endOfMonth(monthStart).getDate();
  const todayMonth = format(startOfMonth(today), "yyyy-MM");

  if (todayMonth === month) {
    return { dayOfMonth: Math.min(Math.max(today.getDate(), 1), daysInMonth), daysInMonth };
  }

  return { dayOfMonth: todayMonth > month ? daysInMonth : 1, daysInMonth };
}

export function computeEndOfMonthProjection(
  transactions: Transaction[],
  budgets: Budget[],
  month: string,
  today = new Date()
): EndOfMonthProjection[] {
  const { dayOfMonth, daysInMonth } = projectionDay(month, today);

  return computeBudgetProgress(transactions, budgets, month).map((progress) => {
    const projectedSpent = (progress.spent / dayOfMonth) * daysInMonth;

    return {
      ...progress,
      projectedSpent,
      projectedRemaining: progress.budget.monthlyAmount - projectedSpent,
      projectedOverage: Math.max(0, projectedSpent - progress.budget.monthlyAmount),
      dayOfMonth,
      daysInMonth
    };
  });
}

export function computeMonthlyReportData(transactions: Transaction[], month: string, budgets: Budget[] = []): MonthlyReportData {
  const monthlyTransactions = transactionsForMonth(transactions, month);
  const monthlyExpenses = monthlyTransactions.filter((transaction) => transaction.amount < 0);
  const categories = computeExpenseCategories(monthlyTransactions);

  return {
    month,
    summary: computeMonthlySummary(transactions, month),
    largestExpense: monthlyExpenses.length > 0 ? [...monthlyExpenses].sort((a, b) => a.amount - b.amount)[0] : null,
    topCategory: categories[0] ?? null,
    recurringExpenses: detectRecurringExpenses(transactions).filter((recurrence) => recurrence.months.includes(month)),
    recurringIncomes: detectRecurringIncome(transactions).filter((income) => income.months.includes(month)),
    unusualExpenses: detectUnusualExpenses(transactions).filter((anomaly) => anomaly.transaction.date?.startsWith(month)),
    budgetProgress: computeBudgetProgress(transactions, budgets, month)
  };
}

export function computeCalendarSummary(transactions: Transaction[], month: string): CalendarDaySummary[] {
  const monthStart = parseValidIsoDate(`${month}-01`);
  if (!monthStart) return [];

  const daysInMonth = endOfMonth(monthStart).getDate();
  const recurringFingerprints = new Set<string>();
  for (const recurrence of detectRecurringExpenses(transactions)) {
    for (const transaction of recurrence.transactions) {
      recurringFingerprints.add(transaction.fingerprint);
    }
  }

  const days = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return {
      date,
      day,
      income: 0,
      expenses: 0,
      net: 0,
      transactions: [] as Transaction[],
      hasRecurring: false,
      isHighExpenseDay: false
    };
  });

  for (const transaction of transactions) {
    if (!transaction.date?.startsWith(month)) continue;
    const day = Number(transaction.date.slice(8, 10));
    const summary = days[day - 1];
    if (!summary) continue;
    summary.transactions.push(transaction);
    if (transaction.amount > 0) summary.income += transaction.amount;
    if (transaction.amount < 0) summary.expenses += Math.abs(transaction.amount);
    summary.net += transaction.amount;
    summary.hasRecurring ||= transaction.recurrenceStatus === "manual" || recurringFingerprints.has(transaction.fingerprint);
  }

  const activeDays = days.filter((day) => day.expenses > 0);
  const averageExpense = activeDays.length > 0 ? activeDays.reduce((sum, day) => sum + day.expenses, 0) / activeDays.length : 0;

  return days.map((day) => ({
    ...day,
    transactions: [...day.transactions].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount)),
    isHighExpenseDay: averageExpense > 0 && day.expenses >= averageExpense * highExpenseDayMultiplier
  }));
}

export function detectBankFees(transactions: Transaction[]): BankFeeDetection[] {
  const feePatterns: Array<{ feeType: BankFeeDetection["feeType"]; keywords: string[] }> = [
    { feeType: "tenue de compte", keywords: ["tenue de compte"] },
    { feeType: "commission", keywords: ["commission"] },
    { feeType: "agios", keywords: ["agios"] },
    { feeType: "cotisation carte", keywords: ["cotisation carte", "cotisation cb"] },
    { feeType: "incident", keywords: ["incident"] },
    { feeType: "intervention", keywords: ["intervention"] },
    { feeType: "frais bancaire", keywords: ["frais bancaire", "frais tenue", "frais retrait"] }
  ];

  return transactions
    .filter((transaction) => transaction.amount < 0)
    .flatMap((transaction) => {
      const haystack = `${transaction.label} ${transaction.rawLabel ?? ""} ${transaction.notes ?? ""} ${transaction.operationType ?? ""}`
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const match = feePatterns
        .flatMap((pattern) => pattern.keywords.map((keyword) => ({ feeType: pattern.feeType, keyword })))
        .find((pattern) => haystack.includes(pattern.keyword));

      return match
        ? [
            {
              transaction,
              feeType: match.feeType,
              keyword: match.keyword,
              amount: Math.abs(transaction.amount)
            }
          ]
        : [];
    })
    .sort((a, b) => (b.transaction.date ?? "").localeCompare(a.transaction.date ?? ""));
}

export function normalizeMerchantLabel(label: string): string {
  const merchantAliases = new Map([
    ["netflix", "netflix"],
    ["netflix com", "netflix"],
    ["orange", "orange"],
    ["orange france", "orange"],
    ["orange mobile", "orange"],
    ["orange internet", "orange"]
  ]);
  const normalized = label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:www\.)?([a-z0-9-]+)\.(?:com|fr|net|org|eu)\b/g, "$1")
    .replace(/\b(cb|carte|paiement|prelevement|prlv|vir|virement|sepa|achat|retrait|facture|internet|mobile|online|web)\b/g, "")
    .replace(/\d+/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  const stopWords = new Set([
    "fr",
    "france",
    "paris",
    "lyon",
    "marseille",
    "toulouse",
    "bordeaux",
    "lille",
    "nantes",
    "market",
    "express",
    "drive",
    "magasin",
    "sas",
    "sa",
    "sarl",
    "com",
    "net",
    "org",
    "www",
    "eu",
    "eur"
  ]);

  const canonical = normalized
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .slice(0, 2)
    .join(" ");

  return merchantAliases.get(canonical) ?? canonical;
}

function titleizeMerchantLabel(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((token) => `${token.slice(0, 1).toUpperCase()}${token.slice(1)}`)
    .join(" ");
}

export function computeMerchantGroups(transactions: Transaction[], limit = 8): MerchantGroup[] {
  const groups = new Map<string, MerchantGroup & { aliasCounts: Map<string, number> }>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const normalizedLabel = normalizeMerchantLabel(transaction.rawLabel || transaction.label);
    if (!normalizedLabel) continue;
    const sourceLabel = transaction.label || transaction.rawLabel || normalizedLabel;
    const existing =
      groups.get(normalizedLabel) ??
      {
        label: titleizeMerchantLabel(normalizedLabel),
        normalizedLabel,
        aliases: [],
        total: 0,
        count: 0,
        lastDate: null,
        aliasCounts: new Map<string, number>()
      };

    existing.total += Math.abs(transaction.amount);
    existing.count += 1;
    existing.lastDate = !existing.lastDate || (transaction.date ?? "") > existing.lastDate ? transaction.date : existing.lastDate;
    existing.aliasCounts.set(sourceLabel, (existing.aliasCounts.get(sourceLabel) ?? 0) + 1);
    existing.aliases = Array.from(existing.aliasCounts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([alias]) => alias);
    existing.label = existing.aliases[0] ?? titleizeMerchantLabel(normalizedLabel);
    groups.set(normalizedLabel, existing);
  }

  return Array.from(groups.values())
    .map(({ aliasCounts: _aliasCounts, ...group }) => group)
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

function monthOffsets(month: string, count: number) {
  const date = parseValidIsoDate(`${month}-01`);
  if (!date) return [];

  return Array.from({ length: count }, (_, index) => format(subMonths(startOfMonth(date), index), "yyyy-MM"));
}

export function filterTransactionsByMerchantPeriod(transactions: Transaction[], period: MerchantPeriod, activeMonth: string | null): Transaction[] {
  if (!activeMonth) return transactions;

  if (period === "month") {
    return transactions.filter((transaction) => transaction.date?.startsWith(activeMonth));
  }

  if (period === "year") {
    const year = activeMonth.slice(0, 4);
    return transactions.filter((transaction) => transaction.date?.startsWith(year));
  }

  const months = new Set(monthOffsets(activeMonth, 3));
  return transactions.filter((transaction) => transaction.date && months.has(transaction.date.slice(0, 7)));
}

export function detectRecurringExpenses(transactions: Transaction[]): RecurringExpense[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0 || transaction.recurrenceStatus === "ignored") continue;
    const key = normalizeMerchantLabel(transaction.rawLabel || transaction.label);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const months = Array.from(new Set(items.map((transaction) => transaction.date?.slice(0, 7)).filter(Boolean) as string[])).sort();
      const totalAmount = items.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
      const averageAmount = items.length > 0 ? totalAmount / items.length : 0;
      const isManual = items.some((transaction) => transaction.recurrenceStatus === "manual");
      return {
        id: key,
        label: items[0]?.label ?? key,
        normalizedLabel: key,
        averageAmount,
        totalAmount,
        count: items.length,
        months,
        transactions: items,
        status: isManual ? "manual" : "detected"
      } satisfies RecurringExpense;
    })
    .filter((recurrence) => {
      if (recurrence.status === "manual") return true;
      if (recurrence.months.length < 2 && recurrence.count < 3) return false;
      const amounts = recurrence.transactions.map((transaction) => Math.abs(transaction.amount));
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      const amountVariation = recurrence.averageAmount > 0 ? (maxAmount - minAmount) / recurrence.averageAmount : 0;
      return amountVariation <= 0.35 || recurrence.count >= 3;
    })
    .sort((a, b) => b.totalAmount - a.totalAmount);
}

export function computeRecurringExpenseMetrics(recurrence: RecurringExpense): RecurringExpenseMetrics {
  const amounts = recurrence.transactions.map((transaction) => Math.abs(transaction.amount));
  const dates = recurrence.transactions.map((transaction) => transaction.date).filter(Boolean).sort() as string[];
  const days = dates.map((date) => Number(date.slice(8, 10))).filter((day) => Number.isFinite(day));
  const minAmount = amounts.length > 0 ? Math.min(...amounts) : 0;
  const maxAmount = amounts.length > 0 ? Math.max(...amounts) : 0;
  const amountVariation = recurrence.averageAmount > 0 ? (maxAmount - minAmount) / recurrence.averageAmount : 0;
  const monthlyHistory = computeRecurringMonthlyHistory(recurrence.transactions);
  const missingMonths = monthlyHistory.filter((month) => month.status === "missing").map((month) => month.month);
  const presentMonthCount = monthlyHistory.length - missingMonths.length;
  const regularityRate = monthlyHistory.length > 0 ? presentMonthCount / monthlyHistory.length : 0;

  return {
    category: transactionCategory(recurrence.transactions[0] ?? ({} as Transaction)),
    minAmount,
    maxAmount,
    monthlyEstimate: recurrence.averageAmount,
    annualEstimate: recurrence.averageAmount * 12,
    averageDayOfMonth: days.length > 0 ? days.reduce((sum, day) => sum + day, 0) / days.length : null,
    amountVariation,
    lastDate: dates[dates.length - 1] ?? null,
    occurrenceCount: recurrence.count,
    monthCount: recurrence.months.length,
    expectedMonthCount: monthlyHistory.length,
    missingMonths,
    regularityRate,
    monthlyHistory
  };
}

export function computeRecurringMonthlyHistory(transactions: Transaction[]): RecurringExpenseMetrics["monthlyHistory"] {
  const byMonth = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (!transaction.date) continue;
    const month = transaction.date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    byMonth.set(month, [...(byMonth.get(month) ?? []), transaction]);
  }

  const months = Array.from(byMonth.keys()).sort();
  const firstMonth = months[0];
  const lastMonth = months[months.length - 1];
  if (!firstMonth || !lastMonth) return [];

  const firstDate = parseValidIsoDate(`${firstMonth}-01`);
  const lastDate = parseValidIsoDate(`${lastMonth}-01`);
  if (!firstDate || !lastDate) return [];

  const history: RecurringExpenseMetrics["monthlyHistory"] = [];

  for (let cursor = startOfMonth(firstDate); cursor <= startOfMonth(lastDate); cursor = addMonths(cursor, 1)) {
    const month = format(cursor, "yyyy-MM");
    const monthTransactions = byMonth.get(month) ?? [];
    history.push({
      month,
      label: new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(cursor),
      status: monthTransactions.length > 0 ? "present" : "missing",
      transactions: monthTransactions,
      totalAmount: monthTransactions.reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0)
    });
  }

  return history;
}

export function transactionsForMonth(transactions: Transaction[], month: string): Transaction[] {
  return transactions.filter((transaction) => transaction.date?.startsWith(month));
}

export function computeMonthComparison(transactions: Transaction[], firstMonth: string, secondMonth: string): MonthComparison {
  const firstTransactions = transactionsForMonth(transactions, firstMonth);
  const secondTransactions = transactionsForMonth(transactions, secondMonth);

  const firstLabels = new Set(firstTransactions.filter((transaction) => transaction.amount < 0).map((transaction) => normalizeMerchantLabel(transaction.label)));
  const secondLabels = new Set(secondTransactions.filter((transaction) => transaction.amount < 0).map((transaction) => normalizeMerchantLabel(transaction.label)));

  return {
    firstMonth,
    secondMonth,
    firstStats: computeStats(firstTransactions),
    secondStats: computeStats(secondTransactions),
    categoryDeltas: computeCategoryDeltas(transactions, firstMonth, secondMonth),
    newExpenses: secondTransactions.filter((transaction) => transaction.amount < 0 && !firstLabels.has(normalizeMerchantLabel(transaction.label))).slice(0, 10),
    goneExpenses: firstTransactions.filter((transaction) => transaction.amount < 0 && !secondLabels.has(normalizeMerchantLabel(transaction.label))).slice(0, 10)
  };
}

export function computeCategoryDeltas(transactions: Transaction[], firstMonth: string, secondMonth: string): MonthComparisonCategory[] {
  const firstCategories = computeExpenseCategories(transactionsForMonth(transactions, firstMonth));
  const secondCategories = computeExpenseCategories(transactionsForMonth(transactions, secondMonth));
  const categoryNames = new Set([...firstCategories.map((category) => category.name), ...secondCategories.map((category) => category.name)]);

  return Array.from(categoryNames)
    .map((name) => {
      const firstAmount = firstCategories.find((category) => category.name === name)?.value ?? 0;
      const secondAmount = secondCategories.find((category) => category.name === name)?.value ?? 0;
      return {
        name,
        firstAmount,
        secondAmount,
        delta: secondAmount - firstAmount,
        percentChange: firstAmount > 0 ? ((secondAmount - firstAmount) / firstAmount) * 100 : null
      };
    })
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

function comparableExpenseHistory(
  transactions: Transaction[],
  transaction: Transaction,
  basis: "category" | "merchant"
): { label: string; amounts: number[] } {
  const transactionDate = parseValidIsoDate(transaction.date);
  const label = basis === "category" ? transactionCategory(transaction) : normalizeMerchantLabel(transaction.rawLabel || transaction.label);

  const amounts = transactions
    .filter((candidate) => {
      if (candidate === transaction || candidate.amount >= 0) return false;
      if (transaction.fingerprint && candidate.fingerprint === transaction.fingerprint) return false;
      const candidateDate = parseValidIsoDate(candidate.date);
      if (transactionDate && candidateDate && !isBefore(candidateDate, transactionDate)) return false;
      return basis === "category"
        ? transactionCategory(candidate) === label
        : normalizeMerchantLabel(candidate.rawLabel || candidate.label) === label;
    })
    .map((candidate) => Math.abs(candidate.amount));

  return { label, amounts };
}

export function detectUnusualExpenses(transactions: Transaction[], limit = 8): ExpenseAnomaly[] {
  const anomalies: ExpenseAnomaly[] = [];

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;
    const amount = Math.abs(transaction.amount);
    const candidates: ExpenseAnomaly[] = [];

    for (const basis of ["category", "merchant"] as const) {
      const history = comparableExpenseHistory(transactions, transaction, basis);
      if (!history.label || history.amounts.length < unusualExpenseMinimumHistory) continue;
      const averageAmount = history.amounts.reduce((sum, value) => sum + value, 0) / history.amounts.length;
      const multiplier = averageAmount > 0 ? amount / averageAmount : 0;
      if (multiplier < unusualExpenseMultiplier) continue;
      candidates.push({
        id: `${transaction.fingerprint || transaction.id || transaction.date}-${basis}`,
        transaction,
        basis,
        referenceLabel: history.label,
        averageAmount,
        multiplier,
        reason:
          basis === "category"
            ? `${multiplier.toFixed(1)}x la moyenne de la categorie`
            : `${multiplier.toFixed(1)}x la moyenne du marchand`
      });
    }

    if (candidates.length > 0) {
      anomalies.push(candidates.sort((a, b) => b.multiplier - a.multiplier)[0]);
    }
  }

  return anomalies.sort((a, b) => b.multiplier - a.multiplier).slice(0, limit);
}

export function computeIncomeStability(transactions: Transaction[]): IncomeStability {
  const amounts = transactions.map((transaction) => transaction.amount).filter((amount) => amount > 0);
  const averageIncome = amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) / amounts.length : 0;
  const minIncome = amounts.length > 0 ? Math.min(...amounts) : 0;
  const maxIncome = amounts.length > 0 ? Math.max(...amounts) : 0;
  const relativeVariation = averageIncome > 0 ? (maxIncome - minIncome) / averageIncome : 0;

  return {
    averageIncome,
    minIncome,
    maxIncome,
    relativeVariation,
    status: relativeVariation <= stableIncomeRelativeVariation ? "stable" : "variable"
  };
}

export function detectRecurringIncome(transactions: Transaction[]): RecurringIncome[] {
  const groups = new Map<string, Transaction[]>();

  for (const transaction of transactions) {
    if (transaction.amount <= 0) continue;
    const key = normalizeMerchantLabel(transaction.rawLabel || transaction.label);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .map(([key, items]) => {
      const months = Array.from(new Set(items.map((transaction) => transaction.date?.slice(0, 7)).filter(Boolean) as string[])).sort();
      return {
        id: key,
        label: items[0]?.label ?? key,
        normalizedLabel: key,
        months,
        count: items.length,
        transactions: items,
        stability: computeIncomeStability(items)
      } satisfies RecurringIncome;
    })
    .filter((income) => income.months.length >= recurringIncomeMinimumMonths)
    .sort((a, b) => b.stability.averageIncome - a.stability.averageIncome);
}

function significantCategoryDeltas(categoryDeltas: MonthComparisonCategory[]) {
  return categoryDeltas.filter(
    (category) =>
      category.delta >= significantCategoryDeltaMinimumAmount &&
      (category.percentChange === null || category.percentChange >= significantCategoryIncreasePercent)
  );
}

export function computeEnhancedMonthAnalysis(transactions: Transaction[], firstMonth: string, secondMonth: string): EnhancedMonthAnalysis {
  const comparison = computeMonthComparison(transactions, firstMonth, secondMonth);
  const firstMerchantKeys = new Set(computeMerchantGroups(transactionsForMonth(transactions, firstMonth), 100).map((merchant) => merchant.normalizedLabel));
  const secondMerchantKeys = new Set(computeMerchantGroups(transactionsForMonth(transactions, secondMonth), 100).map((merchant) => merchant.normalizedLabel));
  const secondMerchants = computeMerchantGroups(transactionsForMonth(transactions, secondMonth), 100);
  const firstMerchants = computeMerchantGroups(transactionsForMonth(transactions, firstMonth), 100);

  return {
    comparison,
    significantCategoryDeltas: significantCategoryDeltas(comparison.categoryDeltas),
    unusualExpenses: detectUnusualExpenses(transactions).filter((anomaly) => anomaly.transaction.date?.startsWith(secondMonth)),
    recurringIncomes: detectRecurringIncome(transactions),
    newMerchants: secondMerchants.filter((merchant) => !firstMerchantKeys.has(merchant.normalizedLabel)).slice(0, 8),
    goneMerchants: firstMerchants.filter((merchant) => !secondMerchantKeys.has(merchant.normalizedLabel)).slice(0, 8)
  };
}

export function getActiveFilterChips(filters: DashboardFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.search) chips.push({ key: "search", label: `Recherche: ${filters.search}` });
  if (filters.startDate || filters.endDate) chips.push({ key: "dateRange", label: `Periode: ${filters.startDate || "..."} - ${filters.endDate || "..."}` });
  if (filters.flow !== "all") chips.push({ key: "flow", label: filters.flow === "expense" ? "Depenses" : "Revenus" });
  if (filters.category) chips.push({ key: "category", label: `Categorie: ${filters.category}` });
  if (filters.subcategory) chips.push({ key: "subcategory", label: `Sous-categorie: ${filters.subcategory}` });
  if (filters.operationType) chips.push({ key: "operationType", label: `Type: ${filters.operationType}` });
  if (filters.minAmount) chips.push({ key: "minAmount", label: `Min: ${filters.minAmount}` });
  if (filters.maxAmount) chips.push({ key: "maxAmount", label: `Max: ${filters.maxAmount}` });
  if (filters.includeExcluded) chips.push({ key: "includeExcluded", label: "Exclus inclus" });
  return chips;
}

export function computeTopMerchants(transactions: Transaction[], limit = 8): MerchantPoint[] {
  return computeMerchantGroups(transactions, limit).map((merchant) => ({
    label: merchant.label,
    total: merchant.total,
    count: merchant.count
  }));
}

export function computePotentialSubscriptions(transactions: Transaction[], limit = 3): MerchantPoint[] {
  return computeTopMerchants(transactions, 50)
    .filter((merchant) => merchant.count >= 2)
    .slice(0, limit);
}

export function computeInsights(transactions: Transaction[], focusMonth?: string | null): FinanceInsight[] {
  const focusTransactions = focusMonth ? transactionsForMonth(transactions, focusMonth) : transactions;
  const stats = computeStats(focusTransactions);
  const categories = computeExpenseCategories(focusTransactions);
  const merchants = computeTopMerchants(focusTransactions, 3);
  const anomalies = detectUnusualExpenses(transactions).filter((anomaly) => !focusMonth || anomaly.transaction.date?.startsWith(focusMonth));
  const recurringIncomes = detectRecurringIncome(transactions);
  const insights: FinanceInsight[] = [];

  if (anomalies[0]) {
    insights.push({
      title: "Depense inhabituelle",
      description: `${Math.abs(anomalies[0].transaction.amount).toFixed(2)} EUR - ${anomalies[0].transaction.label}, ${anomalies[0].reason}`,
      tone: "negative"
    });
  }

  if (categories[0] && stats.expenses > 0) {
    const share = (categories[0].value / stats.expenses) * 100;
    insights.push({
      title: "Categorie dominante",
      description: `${categories[0].name} represente ${share.toFixed(1)} % des depenses`,
      tone: "warning"
    });
  }

  if (recurringIncomes[0]) {
    insights.push({
      title: "Revenu recurrent",
      description: `${recurringIncomes[0].label}: ${recurringIncomes[0].stability.averageIncome.toFixed(2)} EUR en moyenne`,
      tone: recurringIncomes[0].stability.status === "stable" ? "positive" : "neutral"
    });
  }

  if (merchants[0]) {
    insights.push({
      title: "Marchand a surveiller",
      description: `${merchants[0].label}: ${merchants[0].total.toFixed(2)} EUR cumules`,
      tone: "neutral"
    });
  }

  return insights.slice(0, 4);
}

export function uniqueOptions(transactions: Transaction[], selector: (transaction: Transaction) => string | null): string[] {
  return Array.from(new Set(transactions.map(selector).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b));
}

export function currentMonthRange() {
  const now = new Date();
  return {
    startDate: format(startOfMonth(now), "yyyy-MM-dd"),
    endDate: format(endOfMonth(now), "yyyy-MM-dd")
  };
}
