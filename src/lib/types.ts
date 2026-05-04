export type CsvSource = "caisse-epargne" | "trade-republic";

export type Transaction = {
  id: string;
  source: CsvSource;
  fingerprint: string;
  date: string | null;
  bookingDate: string | null;
  operationDate: string | null;
  valueDate: string | null;
  label: string;
  rawLabel: string | null;
  reference: string | null;
  notes: string | null;
  operationType: string | null;
  bankCategory: string | null;
  bankSubcategory: string | null;
  userCategory: string | null;
  userNotes: string | null;
  debit: number;
  credit: number;
  amount: number;
  isChecked: boolean;
  isExcludedFromStats: boolean;
  recurrenceId?: string | null;
  recurrenceStatus?: "manual" | "ignored" | null;
  raw: Record<string, string>;
  createdAt: string;
  updatedAt: string;
};

export type ImportRecord = {
  id: string;
  source: CsvSource;
  fileName: string;
  fileHash: string;
  rowsCount: number;
  validRowsCount: number;
  duplicateRowsCount: number;
  errorRowsCount: number;
  totalDebit: number;
  totalCredit: number;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
};

export type ImportError = {
  rowNumber: number;
  message: string;
  raw: Record<string, string>;
};

export type ImportSummary = {
  importRecord: ImportRecord;
  transactions: Transaction[];
  duplicates: Transaction[];
  errors: ImportError[];
  missingColumns: string[];
};

export type FinanceStore = {
  version: 2;
  transactions: Transaction[];
  imports: ImportRecord[];
  userCategories: string[];
  budgets: Budget[];
  updatedAt: string;
};

export type Budget = {
  id: string;
  category: string;
  monthlyAmount: number;
  createdAt: string;
  updatedAt: string;
};

export type DashboardFilters = {
  search: string;
  startDate: string;
  endDate: string;
  category: string;
  subcategory: string;
  operationType: string;
  flow: "all" | "income" | "expense";
  minAmount: string;
  maxAmount: string;
  includeExcluded: boolean;
};

export type DashboardStats = {
  income: number;
  expenses: number;
  net: number;
  transactionCount: number;
  averageExpense: number;
  averageIncome: number;
  largestExpense: Transaction | null;
  largestIncome: Transaction | null;
};

export type MonthlyPoint = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

export type MonthlySummary = MonthlyPoint & {
  label: string;
  transactionCount: number;
  averageExpense: number;
  averageIncome: number;
  savingsRate: number | null;
};

export type MonthlyComparison = {
  month: string;
  summary: MonthlySummary;
  incomeDelta: number;
  expensesDelta: number;
  netDelta: number;
  savingsRateDelta: number | null;
};

export type MonthlyBenchmarks = {
  activeMonth: string;
  previousMonth: MonthlyComparison | null;
  average3Months: MonthlySummary | null;
  average6Months: MonthlySummary | null;
  bestMonth: MonthlySummary | null;
  worstMonth: MonthlySummary | null;
};

export type DailyPoint = {
  date: string;
  label: string;
  income: number;
  expenses: number;
  net: number;
  balance: number;
};

export type CategoryPoint = {
  name: string;
  value: number;
  count?: number;
};

export type CategorySummary = {
  name: string;
  bankCategory: string | null;
  userCategory: string | null;
  transactionCount: number;
  income: number;
  expenses: number;
  net: number;
  expenseShare: number;
};

export type BudgetProgress = {
  budget: Budget;
  category: string;
  spent: number;
  remaining: number;
  overage: number;
  progress: number;
  transactionCount: number;
};

export type EndOfMonthProjection = BudgetProgress & {
  projectedSpent: number;
  projectedRemaining: number;
  projectedOverage: number;
  dayOfMonth: number;
  daysInMonth: number;
};

export type MonthlyReportData = {
  month: string;
  summary: MonthlySummary;
  largestExpense: Transaction | null;
  topCategory: CategoryPoint | null;
  recurringExpenses: RecurringExpense[];
  recurringIncomes: RecurringIncome[];
  unusualExpenses: ExpenseAnomaly[];
  budgetProgress: BudgetProgress[];
};

export type MerchantPoint = {
  label: string;
  total: number;
  count: number;
};

export type FinanceInsight = {
  title: string;
  description: string;
  tone: "positive" | "warning" | "negative" | "neutral";
};

export type ExpenseAnomaly = {
  id: string;
  transaction: Transaction;
  basis: "category" | "merchant";
  referenceLabel: string;
  averageAmount: number;
  multiplier: number;
  reason: string;
};

export type IncomeStability = {
  averageIncome: number;
  minIncome: number;
  maxIncome: number;
  relativeVariation: number;
  status: "stable" | "variable";
};

export type RecurringIncome = {
  id: string;
  label: string;
  normalizedLabel: string;
  months: string[];
  count: number;
  transactions: Transaction[];
  stability: IncomeStability;
};

export type RecurringExpense = {
  id: string;
  label: string;
  normalizedLabel: string;
  averageAmount: number;
  totalAmount: number;
  count: number;
  months: string[];
  transactions: Transaction[];
  status: "detected" | "manual";
};

export type RecurringExpenseMetrics = {
  category: string;
  minAmount: number;
  maxAmount: number;
  monthlyEstimate: number;
  annualEstimate: number;
  averageDayOfMonth: number | null;
  amountVariation: number;
  lastDate: string | null;
  occurrenceCount: number;
  monthCount: number;
  expectedMonthCount: number;
  missingMonths: string[];
  regularityRate: number;
  monthlyHistory: RecurringMonthlyHistory[];
};

export type RecurringMonthlyHistory = {
  month: string;
  label: string;
  status: "present" | "missing";
  transactions: Transaction[];
  totalAmount: number;
};

export type MerchantGroup = {
  label: string;
  normalizedLabel: string;
  aliases: string[];
  total: number;
  count: number;
  lastDate: string | null;
};

export type MerchantPeriod = "month" | "quarter" | "year";

export type CalendarDaySummary = {
  date: string;
  day: number;
  income: number;
  expenses: number;
  net: number;
  transactions: Transaction[];
  hasRecurring: boolean;
  isHighExpenseDay: boolean;
};

export type BankFeeDetection = {
  transaction: Transaction;
  feeType: "tenue de compte" | "commission" | "agios" | "cotisation carte" | "incident" | "intervention" | "frais bancaire";
  keyword: string;
  amount: number;
};

export type MonthComparisonCategory = {
  name: string;
  firstAmount: number;
  secondAmount: number;
  delta: number;
  percentChange: number | null;
};

export type MonthComparison = {
  firstMonth: string;
  secondMonth: string;
  firstStats: DashboardStats;
  secondStats: DashboardStats;
  categoryDeltas: MonthComparisonCategory[];
  newExpenses: Transaction[];
  goneExpenses: Transaction[];
};

export type EnhancedMonthAnalysis = {
  comparison: MonthComparison;
  significantCategoryDeltas: MonthComparisonCategory[];
  unusualExpenses: ExpenseAnomaly[];
  recurringIncomes: RecurringIncome[];
  newMerchants: MerchantGroup[];
  goneMerchants: MerchantGroup[];
};

export type ActiveFilterChip = {
  key: keyof DashboardFilters | "dateRange";
  label: string;
};
