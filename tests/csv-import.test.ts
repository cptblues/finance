import { describe, expect, it } from "vitest";
import {
  createFingerprint,
  createTradeRepublicFingerprint,
  cleanText,
  normalizeCsvRow,
  normalizeFrenchDate,
  normalizeIsoDate,
  normalizeTradeRepublicCsvRow,
  parseBankCsv,
  parseCaisseEpargneCsv,
  parseTradeRepublicCsv,
  parseFrenchAmount
} from "../src/lib/csv-import";
import {
  applyFilters,
  computeCategorySummaries,
  computeCategoryDeltas,
  computeCalendarSummary,
  computeDailyPoints,
  computeEnhancedMonthAnalysis,
  computeEndOfMonthProjection,
  computeIncomeStability,
  computeBudgetProgress,
  computeMerchantGroups,
  computeMonthlyBenchmarks,
  computeMonthlyReportData,
  computeMonthlySummary,
  computeMonthlyTrend,
  computeMonthComparison,
  computeExpenseCategories,
  computeRecurringMonthlyHistory,
  computeRecurringExpenseMetrics,
  computeStats,
  detectRecurringIncome,
  detectRecurringExpenses,
  detectBankFees,
  detectUnusualExpenses,
  defaultFilters,
  filterTransactionsByMerchantPeriod,
  getAvailableMonths,
  getDefaultDashboardMonth,
  normalizeMerchantLabel
} from "../src/lib/analysis";
import { createEmptyStore, migrateFinanceStore, removeUserCategory } from "../src/lib/finance-store";
import type { Transaction } from "../src/lib/types";

const header = [
  "Date de comptabilisation",
  "Libelle simplifie",
  "Libelle operation",
  "Reference",
  "Informations complementaires",
  "Type operation",
  "Categorie",
  "Sous categorie",
  "Debit",
  "Credit",
  "Date operation",
  "Date de valeur",
  "Pointage operation"
].join(";");

function csvLine(values: string[]) {
  return values.join(";");
}

const tradeRepublicColumns = [
  "datetime",
  "date",
  "account_type",
  "category",
  "type",
  "asset_class",
  "name",
  "symbol",
  "shares",
  "price",
  "amount",
  "fee",
  "tax",
  "currency",
  "original_amount",
  "original_currency",
  "fx_rate",
  "description",
  "transaction_id",
  "counterparty_name",
  "counterparty_iban",
  "payment_reference",
  "mcc_code"
];

function tradeRepublicLine(overrides: Partial<Record<(typeof tradeRepublicColumns)[number], string>> = {}, delimiter = ",") {
  const row: Record<string, string> = {
    datetime: "2026-03-04T10:15:00.000Z",
    date: "2026-03-04",
    account_type: "cash",
    category: "interest",
    type: "INTEREST",
    asset_class: "",
    name: "Interest",
    symbol: "",
    shares: "",
    price: "",
    amount: "1.23",
    fee: "0",
    tax: "0",
    currency: "EUR",
    original_amount: "1.23",
    original_currency: "EUR",
    fx_rate: "1",
    description: "Monthly interest",
    transaction_id: "tr-1",
    counterparty_name: "Trade Republic",
    counterparty_iban: "",
    payment_reference: "",
    mcc_code: "",
    ...overrides
  };

  return tradeRepublicColumns.map((column) => row[column]).join(delimiter);
}

describe("csv import", () => {
  it("parses French amounts", () => {
    expect(parseFrenchAmount("1 234,56")).toBe(1234.56);
    expect(parseFrenchAmount("")).toBe(0);
    expect(parseFrenchAmount(null)).toBe(0);
    expect(parseFrenchAmount("bad")).toBe(0);
  });

  it("repairs common mojibake around the degree symbol", () => {
    expect(cleanText("Paiement NÂ° 123")).toBe("Paiement N° 123");
    expect(cleanText("Paiement N° 123")).toBe("Paiement N° 123");
  });

  it("normalizes French dates", () => {
    expect(normalizeFrenchDate("04/03/2026")).toBe("2026-03-04");
    expect(normalizeFrenchDate("")).toBeNull();
    expect(normalizeFrenchDate("2026-03-04")).toBeNull();
  });

  it("normalizes ISO dates and datetimes", () => {
    expect(normalizeIsoDate("2026-03-04")).toBe("2026-03-04");
    expect(normalizeIsoDate("2026-03-04T10:15:00.000Z")).toBe("2026-03-04");
    expect(normalizeIsoDate("04/03/2026")).toBeNull();
  });

  it("maps signed negative amounts to expenses", async () => {
    const row = {
      "Date de comptabilisation": "05/03/2026",
      "Libelle simplifie": "Supermarche",
      "Libelle operation": "CB SUPERMARCHE PARIS",
      Reference: "ABC123",
      "Informations complementaires": "Carte",
      "Type operation": "Carte bancaire",
      Categorie: "Vie quotidienne",
      "Sous categorie": "Alimentation",
      Debit: "-42,30",
      Credit: "",
      "Date operation": "04/03/2026",
      "Date de valeur": "05/03/2026",
      "Pointage operation": "Oui"
    };

    const transaction = await normalizeCsvRow(row, "2026-04-30T00:00:00.000Z");

    expect(transaction.date).toBe("2026-03-04");
    expect(transaction.bookingDate).toBe("2026-03-05");
    expect(transaction.label).toBe("Supermarche");
    expect(transaction.rawLabel).toBe("CB SUPERMARCHE PARIS");
    expect(transaction.debit).toBe(-42.3);
    expect(transaction.credit).toBe(0);
    expect(transaction.amount).toBe(-42.3);
    expect(transaction.isChecked).toBe(true);
    expect(transaction.bankCategory).toBe("Vie quotidienne");
    expect(transaction.raw).toEqual(row);
  });

  it("uses positive signed amount as income", async () => {
    const row = {
      "Date de comptabilisation": "01/03/2026",
      "Libelle simplifie": "Salaire",
      "Libelle operation": "VIR SALAIRE",
      Reference: "PAY",
      "Informations complementaires": "",
      "Type operation": "Virement",
      Categorie: "Revenus",
      "Sous categorie": "Salaire",
      Debit: "",
      Credit: "2 500,00",
      "Date operation": "01/03/2026",
      "Date de valeur": "01/03/2026",
      "Pointage operation": ""
    };

    const transaction = await normalizeCsvRow(row);
    expect(transaction.amount).toBe(2500);
  });

  it("treats negative credit as expense", async () => {
    const row = {
      "Date de comptabilisation": "05/03/2026",
      "Libelle simplifie": "Supermarche",
      "Libelle operation": "CB SUPERMARCHE PARIS",
      Reference: "ABC123",
      "Informations complementaires": "Carte",
      "Type operation": "Carte bancaire",
      Categorie: "Vie quotidienne",
      "Sous categorie": "Alimentation",
      Debit: "",
      Credit: "-42,30",
      "Date operation": "04/03/2026",
      "Date de valeur": "05/03/2026",
      "Pointage operation": "Oui"
    };

    const transaction = await normalizeCsvRow(row);
    expect(transaction.amount).toBe(-42.3);
  });

  it("parses trailing negative and thousands separators", () => {
    expect(parseFrenchAmount("1.234,56-")).toBe(-1234.56);
    expect(parseFrenchAmount("(1 234,56)")).toBe(-1234.56);
  });

  it("creates stable fingerprints", async () => {
    const row = {
      "Date operation": "01/03/2026",
      "Libelle operation": "CB TEST",
      Reference: "R1",
      Debit: "10,00",
      Credit: ""
    };

    await expect(createFingerprint(row)).resolves.toBe(await createFingerprint(row));
  });

  it("creates stable Trade Republic fingerprints", async () => {
    const row = {
      datetime: "2026-03-04T10:15:00.000Z",
      date: "2026-03-04",
      transaction_id: "tr-1",
      amount: "1.23",
      fee: "0",
      tax: "0",
      currency: "EUR",
      type: "INTEREST",
      name: "Interest",
      symbol: ""
    };

    await expect(createTradeRepublicFingerprint(row)).resolves.toBe(await createTradeRepublicFingerprint(row));
  });

  it("parses CSV with semicolon and detects duplicates", async () => {
    const content = [
      header,
      csvLine(["05/03/2026", "Cafe", "CB CAFE", "R1", "", "Carte", "Loisirs", "Cafe", "-3,20", "", "04/03/2026", "05/03/2026", ""]),
      csvLine(["05/03/2026", "Cafe", "CB CAFE", "R1", "", "Carte", "Loisirs", "Cafe", "-3,20", "", "04/03/2026", "05/03/2026", ""])
    ].join("\n");

    const summary = await parseCaisseEpargneCsv(content, "test.csv");

    expect(summary.missingColumns).toEqual([]);
    expect(summary.importRecord.rowsCount).toBe(2);
    expect(summary.importRecord.validRowsCount).toBe(1);
    expect(summary.importRecord.duplicateRowsCount).toBe(1);
    expect(summary.importRecord.totalDebit).toBe(3.2);
  });

  it("reports missing columns", async () => {
    const summary = await parseCaisseEpargneCsv("Debit;Credit\n1,00;", "bad.csv");
    expect(summary.missingColumns).toContain("Date operation");
    expect(summary.transactions).toHaveLength(0);
  });

  it("maps a Trade Republic positive amount as income", async () => {
    const transaction = await normalizeTradeRepublicCsvRow({
      datetime: "2026-03-04T10:15:00.000Z",
      date: "2026-03-04",
      account_type: "cash",
      category: "interest",
      type: "INTEREST",
      asset_class: "",
      name: "Interest",
      symbol: "",
      shares: "",
      price: "",
      amount: "1.23",
      fee: "0",
      tax: "0",
      currency: "EUR",
      original_amount: "1.23",
      original_currency: "EUR",
      fx_rate: "1",
      description: "Monthly interest",
      transaction_id: "tr-1",
      counterparty_name: "Trade Republic",
      counterparty_iban: "",
      payment_reference: "",
      mcc_code: ""
    });

    expect(transaction.source).toBe("trade-republic");
    expect(transaction.date).toBe("2026-03-04");
    expect(transaction.label).toBe("Monthly interest");
    expect(transaction.bankCategory).toBe("interest");
    expect(transaction.amount).toBe(1.23);
    expect(transaction.credit).toBe(1.23);
    expect(transaction.debit).toBe(0);
    expect(transaction.raw.fee).toBe("0");
  });

  it("maps a Trade Republic negative amount as expense and keeps asset fields raw", async () => {
    const transaction = await normalizeTradeRepublicCsvRow({
      datetime: "2026-03-04T10:15:00.000Z",
      date: "2026-03-04",
      account_type: "securities",
      category: "order",
      type: "ORDER",
      asset_class: "stock",
      name: "Example AG",
      symbol: "EXM",
      shares: "2",
      price: "10.00",
      amount: "-20.00",
      fee: "-1.00",
      tax: "0",
      currency: "EUR",
      original_amount: "-20.00",
      original_currency: "EUR",
      fx_rate: "1",
      description: "",
      transaction_id: "tr-2",
      counterparty_name: "",
      counterparty_iban: "",
      payment_reference: "",
      mcc_code: ""
    });

    expect(transaction.label).toBe("Example AG");
    expect(transaction.rawLabel).toBe("ORDER - Example AG - EXM");
    expect(transaction.bankSubcategory).toBe("stock");
    expect(transaction.amount).toBe(-20);
    expect(transaction.debit).toBe(-20);
    expect(transaction.credit).toBe(0);
    expect(transaction.raw.shares).toBe("2");
    expect(transaction.raw.symbol).toBe("EXM");
    expect(transaction.raw.fee).toBe("-1.00");
  });

  it("parses Trade Republic CSV with comma separator", async () => {
    const content = [tradeRepublicColumns.join(","), tradeRepublicLine()].join("\n");

    const summary = await parseTradeRepublicCsv(content, "tr.csv");

    expect(summary.missingColumns).toEqual([]);
    expect(summary.importRecord.source).toBe("trade-republic");
    expect(summary.importRecord.validRowsCount).toBe(1);
    expect(summary.importRecord.totalCredit).toBe(1.23);
  });

  it("parses Trade Republic CSV with tab separator", async () => {
    const content = [tradeRepublicColumns.join("\t"), tradeRepublicLine({ amount: "-42.30", transaction_id: "tr-tab" }, "\t")].join("\n");

    const summary = await parseTradeRepublicCsv(content, "tr.tsv");

    expect(summary.missingColumns).toEqual([]);
    expect(summary.transactions[0].amount).toBe(-42.3);
    expect(summary.importRecord.totalDebit).toBe(42.3);
  });

  it("deduplicates Trade Republic rows", async () => {
    const content = [tradeRepublicColumns.join(","), tradeRepublicLine(), tradeRepublicLine()].join("\n");

    const summary = await parseTradeRepublicCsv(content, "tr.csv");

    expect(summary.importRecord.validRowsCount).toBe(1);
    expect(summary.importRecord.duplicateRowsCount).toBe(1);
  });

  it("reports missing Trade Republic columns", async () => {
    const summary = await parseTradeRepublicCsv("date,amount\n2026-03-04,1.23", "bad-tr.csv");

    expect(summary.missingColumns).toContain("datetime");
    expect(summary.missingColumns).toContain("transaction_id");
    expect(summary.transactions).toHaveLength(0);
  });

  it("routes imports through the selected bank profile", async () => {
    const caisseSummary = await parseBankCsv(
      [
        header,
        csvLine(["05/03/2026", "Cafe", "CB CAFE", "R1", "", "Carte", "Loisirs", "Cafe", "-3,20", "", "04/03/2026", "05/03/2026", ""])
      ].join("\n"),
      "ce.csv",
      "caisse-epargne"
    );
    const tradeSummary = await parseBankCsv([tradeRepublicColumns.join(","), tradeRepublicLine()].join("\n"), "tr.csv", "trade-republic");

    expect(caisseSummary.importRecord.source).toBe("caisse-epargne");
    expect(tradeSummary.importRecord.source).toBe("trade-republic");
  });

  it("filters expenses and computes expense categories from signed amounts", () => {
    const transactions = [
      {
        fingerprint: "expense",
        date: "2026-03-04",
        label: "Cafe",
        rawLabel: "CB CAFE",
        bankCategory: "Loisirs",
        bankSubcategory: "Cafe",
        amount: -3.2,
        debit: 0,
        credit: -3.2,
        isExcludedFromStats: false
      },
      {
        fingerprint: "income",
        date: "2026-03-05",
        label: "Salaire",
        rawLabel: "VIR SALAIRE",
        bankCategory: "Revenus",
        bankSubcategory: "Salaire",
        amount: 2500,
        debit: 0,
        credit: 2500,
        isExcludedFromStats: false
      }
    ] as Transaction[];

    const expenses = applyFilters(transactions, { ...defaultFilters, flow: "expense" });
    const stats = computeStats(transactions);
    const categories = computeExpenseCategories(transactions);

    expect(expenses).toHaveLength(1);
    expect(expenses[0].fingerprint).toBe("expense");
    expect(stats.expenses).toBe(3.2);
    expect(stats.income).toBe(2500);
    expect(categories).toEqual([{ name: "Loisirs", value: 3.2, count: 1 }]);
  });

  it("computes daily points with empty days and cumulative balance", () => {
    const transactions = [
      { date: "2026-03-01", amount: 100, isExcludedFromStats: false },
      { date: "2026-03-03", amount: -25, isExcludedFromStats: false }
    ] as Transaction[];

    const points = computeDailyPoints(transactions);

    expect(points).toHaveLength(3);
    expect(points.map((point) => point.date)).toEqual(["2026-03-01", "2026-03-02", "2026-03-03"]);
    expect(points.map((point) => point.balance)).toEqual([100, 100, 75]);
  });

  it("filters dates inclusively and ignores invalid filter dates without crashing", () => {
    const transactions = [
      { fingerprint: "march", date: "2026-03-31", amount: -10, isExcludedFromStats: false },
      { fingerprint: "april", date: "2026-04-01", amount: -20, isExcludedFromStats: false }
    ] as Transaction[];

    expect(applyFilters(transactions, { ...defaultFilters, startDate: "2026-03-01", endDate: "2026-03-31" })).toHaveLength(1);
    expect(applyFilters(transactions, { ...defaultFilters, startDate: "bad-date", endDate: "2026-03-31" })).toHaveLength(1);
  });

  it("lists available months from imported transactions", () => {
    const transactions = [
      { date: "2026-03-31", amount: -10, isExcludedFromStats: false },
      { date: "2026-04-01", amount: -20, isExcludedFromStats: false },
      { date: null, amount: -20, isExcludedFromStats: false }
    ] as Transaction[];

    expect(getAvailableMonths(transactions).map((month) => month.value)).toEqual(["2026-04", "2026-03"]);
  });

  it("computes monthly summary with savings rate", () => {
    const transactions = [
      { date: "2026-03-01", amount: 3000, isExcludedFromStats: false },
      { date: "2026-03-02", amount: -1200, isExcludedFromStats: false },
      { date: "2026-03-03", amount: -300, isExcludedFromStats: false },
      { date: "2026-04-01", amount: -999, isExcludedFromStats: false }
    ] as Transaction[];

    const summary = computeMonthlySummary(transactions, "2026-03");

    expect(summary.income).toBe(3000);
    expect(summary.expenses).toBe(1500);
    expect(summary.net).toBe(1500);
    expect(summary.transactionCount).toBe(3);
    expect(summary.savingsRate).toBe(0.5);
  });

  it("returns null savings rate when monthly income is zero", () => {
    const transactions = [
      { date: "2026-03-01", amount: -100, isExcludedFromStats: false }
    ] as Transaction[];

    expect(computeMonthlySummary(transactions, "2026-03").savingsRate).toBeNull();
  });

  it("selects the latest imported month as default dashboard month", () => {
    const transactions = [
      { date: "2026-01-01", amount: 100, isExcludedFromStats: false },
      { date: "2026-03-01", amount: -20, isExcludedFromStats: false },
      { date: null, amount: 999, isExcludedFromStats: false }
    ] as Transaction[];

    expect(getDefaultDashboardMonth(transactions)).toBe("2026-03");
  });

  it("computes monthly benchmarks against previous month and recent averages", () => {
    const transactions = [
      { date: "2026-01-01", amount: 1000, isExcludedFromStats: false },
      { date: "2026-01-02", amount: -400, isExcludedFromStats: false },
      { date: "2026-02-01", amount: 1200, isExcludedFromStats: false },
      { date: "2026-02-02", amount: -500, isExcludedFromStats: false },
      { date: "2026-03-01", amount: 1500, isExcludedFromStats: false },
      { date: "2026-03-02", amount: -700, isExcludedFromStats: false },
      { date: "2026-04-01", amount: 1400, isExcludedFromStats: false },
      { date: "2026-04-02", amount: -900, isExcludedFromStats: false }
    ] as Transaction[];

    const benchmarks = computeMonthlyBenchmarks(transactions, "2026-04");

    expect(benchmarks.previousMonth?.month).toBe("2026-03");
    expect(benchmarks.previousMonth?.summary.net).toBe(800);
    expect(benchmarks.previousMonth?.netDelta).toBe(-300);
    expect(benchmarks.average3Months?.net).toBeCloseTo((600 + 700 + 800) / 3);
    expect(benchmarks.average6Months?.net).toBeCloseTo((600 + 700 + 800) / 3);
    expect(benchmarks.bestMonth?.month).toBe("2026-03");
    expect(benchmarks.worstMonth?.month).toBe("2026-04");
  });

  it("ignores invalid dates in monthly trend", () => {
    const transactions = [
      { date: "bad", amount: 100, isExcludedFromStats: false },
      { date: null, amount: 200, isExcludedFromStats: false },
      { date: "2026-03-01", amount: -50, isExcludedFromStats: false }
    ] as Transaction[];

    expect(computeMonthlyTrend(transactions).map((summary) => summary.month)).toEqual(["2026-03"]);
  });

  it("computes monthly report data for the future monthly review", () => {
    const transactions = [
      { fingerprint: "salary-1", date: "2026-02-28", label: "Salaire", rawLabel: "VIR SALAIRE", amount: 2500, bankCategory: "Revenus" },
      { fingerprint: "salary-2", date: "2026-03-28", label: "Salaire", rawLabel: "VIR SALAIRE", amount: 2500, bankCategory: "Revenus" },
      { fingerprint: "rent", date: "2026-03-03", label: "Loyer", rawLabel: "PRLV LOYER", amount: -800, bankCategory: "Logement" },
      { fingerprint: "food-1", date: "2026-01-04", label: "Courses", rawLabel: "CB COURSES", amount: -80, bankCategory: "Alimentation" },
      { fingerprint: "food-2", date: "2026-02-04", label: "Courses", rawLabel: "CB COURSES", amount: -90, bankCategory: "Alimentation" },
      { fingerprint: "food-3", date: "2026-02-15", label: "Courses", rawLabel: "CB COURSES", amount: -85, bankCategory: "Alimentation" },
      { fingerprint: "food-4", date: "2026-03-04", label: "Courses exceptionnelles", rawLabel: "CB COURSES", amount: -250, bankCategory: "Alimentation" },
      { fingerprint: "spotify-1", date: "2026-02-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -10, bankCategory: "Loisirs" },
      { fingerprint: "spotify-2", date: "2026-03-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -10, bankCategory: "Loisirs" }
    ] as Transaction[];
    const budgets = [{ id: "b1", category: "Alimentation", monthlyAmount: 200, createdAt: "now", updatedAt: "now" }];

    const report = computeMonthlyReportData(transactions, "2026-03", budgets);

    expect(report.summary.income).toBe(2500);
    expect(report.summary.expenses).toBe(1060);
    expect(report.largestExpense?.label).toBe("Loyer");
    expect(report.topCategory?.name).toBe("Logement");
    expect(report.recurringExpenses.some((recurrence) => recurrence.label === "Spotify")).toBe(true);
    expect(report.recurringIncomes[0].label).toBe("Salaire");
    expect(report.unusualExpenses[0].transaction.label).toBe("Courses exceptionnelles");
    expect(report.budgetProgress[0].spent).toBe(250);
  });

  it("returns empty monthly report data for a month without transactions", () => {
    const report = computeMonthlyReportData([], "2026-03");

    expect(report.summary.transactionCount).toBe(0);
    expect(report.largestExpense).toBeNull();
    expect(report.topCategory).toBeNull();
    expect(report.recurringExpenses).toEqual([]);
    expect(report.recurringIncomes).toEqual([]);
    expect(report.unusualExpenses).toEqual([]);
    expect(report.budgetProgress).toEqual([]);
  });

  it("computes category summaries", () => {
    const transactions = [
      { bankCategory: "Alimentation", userCategory: null, amount: -20, isExcludedFromStats: false },
      { bankCategory: "Alimentation", userCategory: null, amount: -30, isExcludedFromStats: false },
      { bankCategory: "Salaire", userCategory: null, amount: 100, isExcludedFromStats: false }
    ] as Transaction[];

    const summaries = computeCategorySummaries(transactions);

    expect(summaries[0].name).toBe("Alimentation");
    expect(summaries[0].expenses).toBe(50);
    expect(summaries[0].transactionCount).toBe(2);
  });

  it("uses user category instead of bank category for summaries", () => {
    const transactions = [
      { bankCategory: "Banque", userCategory: "Courses", amount: -20, isExcludedFromStats: false }
    ] as Transaction[];

    expect(computeCategorySummaries(transactions)[0].name).toBe("Courses");
    expect(computeExpenseCategories(transactions)[0].name).toBe("Courses");
  });

  it("normalizes close merchant labels and groups them", () => {
    const transactions = [
      { date: "2026-03-01", label: "CB CARREFOUR PARIS 123", rawLabel: "CB CARREFOUR PARIS 123", amount: -20 },
      { date: "2026-03-02", label: "CARREFOUR MARKET", rawLabel: "CARREFOUR MARKET", amount: -30 },
      { date: "2026-03-03", label: "Paiement Carrefour 456", rawLabel: "Paiement Carrefour 456", amount: -10 },
      { date: "2026-03-04", label: "Salaire", rawLabel: "VIR SALAIRE", amount: 1000 }
    ] as Transaction[];

    expect(normalizeMerchantLabel("CB CARREFOUR PARIS 123")).toBe("carrefour");
    expect(computeMerchantGroups(transactions)).toMatchObject([
      {
        normalizedLabel: "carrefour",
        total: 60,
        count: 3
      }
    ]);
  });

  it("normalizes merchant domain and brand variants for recurring detection", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Netflix", rawLabel: "CB NETFLIX.COM", amount: -13.49 },
      { fingerprint: "2", date: "2026-02-05", label: "Netflix.com", rawLabel: "CB NETFLIX", amount: -13.49 },
      { fingerprint: "3", date: "2026-01-08", label: "ORANGE", rawLabel: "PRLV ORANGE FRANCE", amount: -29.99 },
      { fingerprint: "4", date: "2026-02-08", label: "ORANGE", rawLabel: "PRLV ORANGE", amount: -29.99 }
    ] as Transaction[];

    const recurrences = detectRecurringExpenses(transactions);

    expect(normalizeMerchantLabel("CB NETFLIX.COM")).toBe("netflix");
    expect(normalizeMerchantLabel("PRLV ORANGE FRANCE")).toBe("orange");
    expect(recurrences.map((recurrence) => recurrence.normalizedLabel).sort()).toEqual(["netflix", "orange"]);
    expect(recurrences.every((recurrence) => recurrence.count === 2)).toBe(true);
  });

  it("sorts merchant groups by total expense", () => {
    const transactions = [
      { date: "2026-03-01", label: "Cafe", rawLabel: "CB CAFE", amount: -5 },
      { date: "2026-03-02", label: "Amazon", rawLabel: "CB AMAZON", amount: -100 },
      { date: "2026-03-03", label: "Cafe", rawLabel: "CB CAFE", amount: -10 }
    ] as Transaction[];

    expect(computeMerchantGroups(transactions).map((merchant) => merchant.normalizedLabel)).toEqual(["amazon", "cafe"]);
  });

  it("filters merchant transactions by month, quarter and year", () => {
    const transactions = [
      { date: "2026-01-01", amount: -10 },
      { date: "2026-02-01", amount: -20 },
      { date: "2026-03-01", amount: -30 },
      { date: "2026-04-01", amount: -40 },
      { date: "2025-04-01", amount: -50 }
    ] as Transaction[];

    expect(filterTransactionsByMerchantPeriod(transactions, "month", "2026-04")).toHaveLength(1);
    expect(filterTransactionsByMerchantPeriod(transactions, "quarter", "2026-04").map((transaction) => transaction.amount)).toEqual([-20, -30, -40]);
    expect(filterTransactionsByMerchantPeriod(transactions, "year", "2026-04")).toHaveLength(4);
  });

  it("detects unusual expenses by category with enough history", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-01", label: "Courses A", bankCategory: "Alimentation", amount: -10 },
      { fingerprint: "2", date: "2026-02-01", label: "Courses B", bankCategory: "Alimentation", amount: -12 },
      { fingerprint: "3", date: "2026-03-01", label: "Courses C", bankCategory: "Alimentation", amount: -11 },
      { fingerprint: "4", date: "2026-04-01", label: "Grosses courses", bankCategory: "Alimentation", amount: -50 }
    ] as Transaction[];

    const anomaly = detectUnusualExpenses(transactions)[0];

    expect(anomaly.basis).toBe("category");
    expect(anomaly.referenceLabel).toBe("Alimentation");
    expect(anomaly.multiplier).toBeGreaterThan(4);
  });

  it("detects unusual expenses by merchant when category history is not unusual", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-01", label: "Amazon", rawLabel: "CB AMAZON", bankCategory: "Shopping", amount: -10 },
      { fingerprint: "2", date: "2026-02-01", label: "Amazon", rawLabel: "CB AMAZON", bankCategory: "Shopping", amount: -12 },
      { fingerprint: "3", date: "2026-03-01", label: "Amazon", rawLabel: "CB AMAZON", bankCategory: "Shopping", amount: -8 },
      { fingerprint: "4", date: "2026-01-10", label: "Boutique", rawLabel: "CB BOUTIQUE", bankCategory: "Shopping", amount: -80 },
      { fingerprint: "5", date: "2026-02-10", label: "Boutique", rawLabel: "CB BOUTIQUE", bankCategory: "Shopping", amount: -90 },
      { fingerprint: "6", date: "2026-04-01", label: "Amazon", rawLabel: "CB AMAZON", bankCategory: "Shopping", amount: -80 }
    ] as Transaction[];

    const anomaly = detectUnusualExpenses(transactions)[0];

    expect(anomaly.basis).toBe("merchant");
    expect(anomaly.referenceLabel).toBe("amazon");
  });

  it("does not flag unusual expenses with insufficient comparable history", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-01", label: "Courses A", bankCategory: "Alimentation", amount: -10 },
      { fingerprint: "2", date: "2026-02-01", label: "Courses B", bankCategory: "Alimentation", amount: -12 },
      { fingerprint: "3", date: "2026-03-01", label: "Grosses courses", bankCategory: "Alimentation", amount: -100 }
    ] as Transaction[];

    expect(detectUnusualExpenses(transactions)).toHaveLength(0);
  });

  it("detects significant category increases between months", () => {
    const transactions = [
      { date: "2026-01-01", label: "Train", bankCategory: "Transport", amount: -100 },
      { date: "2026-02-01", label: "Train", bankCategory: "Transport", amount: -180 }
    ] as Transaction[];

    const analysis = computeEnhancedMonthAnalysis(transactions, "2026-01", "2026-02");

    expect(computeCategoryDeltas(transactions, "2026-01", "2026-02")[0].percentChange).toBe(80);
    expect(analysis.significantCategoryDeltas[0].name).toBe("Transport");
  });

  it("detects recurring income by normalized label and computes stability", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-28", label: "Salaire", rawLabel: "VIR SALAIRE", amount: 2500 },
      { fingerprint: "2", date: "2026-02-28", label: "Salaire", rawLabel: "SALAIRE", amount: 2520 },
      { fingerprint: "3", date: "2026-03-28", label: "Salaire", rawLabel: "VIREMENT SALAIRE", amount: 2510 },
      { fingerprint: "4", date: "2026-03-01", label: "Courses", rawLabel: "CB COURSES", amount: -100 }
    ] as Transaction[];

    const income = detectRecurringIncome(transactions)[0];
    const stability = computeIncomeStability(income.transactions);

    expect(income.normalizedLabel).toBe("salaire");
    expect(income.months).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(stability.averageIncome).toBeCloseTo(2510);
    expect(stability.minIncome).toBe(2500);
    expect(stability.maxIncome).toBe(2520);
    expect(stability.status).toBe("stable");
  });

  it("removes a user category from suggestions and assigned transactions", () => {
    const store = {
      version: 1,
      userCategories: ["Courses", "Loisirs"],
      imports: [],
      transactions: [
        { fingerprint: "1", userCategory: "Courses", bankCategory: "Banque", updatedAt: "old" },
        { fingerprint: "2", userCategory: "Loisirs", bankCategory: "Banque", updatedAt: "old" },
        { fingerprint: "3", userCategory: null, bankCategory: "Courses", updatedAt: "old" }
      ],
      updatedAt: "old"
    } as unknown as ReturnType<typeof removeUserCategory>;

    const nextStore = removeUserCategory(store, "Courses");

    expect(nextStore.userCategories).toEqual(["Loisirs"]);
    expect(nextStore.transactions[0].userCategory).toBeNull();
    expect(nextStore.transactions[1].userCategory).toBe("Loisirs");
    expect(nextStore.transactions[2].bankCategory).toBe("Courses");
  });

  it("creates and migrates finance stores with budgets", () => {
    expect(createEmptyStore().version).toBe(2);
    expect(createEmptyStore().budgets).toEqual([]);

    const migrated = migrateFinanceStore({
      version: 1,
      transactions: [{ fingerprint: "1" }],
      imports: [],
      userCategories: ["Courses"],
      updatedAt: "old"
    });

    expect(migrated.version).toBe(2);
    expect(migrated.budgets).toEqual([]);
    expect(migrated.transactions).toHaveLength(1);
    expect(migrated.userCategories).toEqual(["Courses"]);
  });

  it("computes budget progress from effective categories", () => {
    const transactions = [
      { date: "2026-03-01", amount: -80, bankCategory: "Banque", userCategory: "Courses" },
      { date: "2026-03-02", amount: -40, bankCategory: "Courses", userCategory: null },
      { date: "2026-03-03", amount: -20, bankCategory: "Loisirs", userCategory: null },
      { date: "2026-04-01", amount: -999, bankCategory: "Courses", userCategory: null }
    ] as Transaction[];
    const budgets = [
      { id: "b1", category: "Courses", monthlyAmount: 100, createdAt: "now", updatedAt: "now" }
    ];

    const progress = computeBudgetProgress(transactions, budgets, "2026-03")[0];

    expect(progress.spent).toBe(120);
    expect(progress.remaining).toBe(-20);
    expect(progress.overage).toBe(20);
    expect(progress.progress).toBe(1.2);
    expect(progress.transactionCount).toBe(2);
  });

  it("computes end of month projections for first, middle and last day", () => {
    const transactions = [
      { date: "2026-03-01", amount: -10, bankCategory: "Courses", userCategory: null },
      { date: "2026-03-10", amount: -90, bankCategory: "Courses", userCategory: null }
    ] as Transaction[];
    const budgets = [
      { id: "b1", category: "Courses", monthlyAmount: 200, createdAt: "now", updatedAt: "now" }
    ];

    expect(computeEndOfMonthProjection(transactions, budgets, "2026-03", new Date("2026-03-01T12:00:00"))[0].projectedSpent).toBe(3100);
    expect(computeEndOfMonthProjection(transactions, budgets, "2026-03", new Date("2026-03-10T12:00:00"))[0].projectedSpent).toBe(310);
    expect(computeEndOfMonthProjection(transactions, budgets, "2026-03", new Date("2026-03-31T12:00:00"))[0].projectedSpent).toBe(100);
  });

  it("groups calendar summaries by day and ignores out-of-month transactions", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-03-01", label: "Salaire", amount: 1000 },
      { fingerprint: "2", date: "2026-03-01", label: "Courses", amount: -120 },
      { fingerprint: "3", date: "2026-03-02", label: "Cafe", amount: -5 },
      { fingerprint: "4", date: "2026-04-01", label: "Avril", amount: -999 },
      { fingerprint: "5", date: null, label: "Sans date", amount: -999 }
    ] as Transaction[];

    const days = computeCalendarSummary(transactions, "2026-03");

    expect(days).toHaveLength(31);
    expect(days[0].income).toBe(1000);
    expect(days[0].expenses).toBe(120);
    expect(days[0].net).toBe(880);
    expect(days[0].transactions.map((transaction) => transaction.label)).toEqual(["Salaire", "Courses"]);
    expect(days[1].expenses).toBe(5);
  });

  it("marks high expense and recurring days in calendar summaries", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -10 },
      { fingerprint: "2", date: "2026-02-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -10 },
      { fingerprint: "3", date: "2026-03-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -10 },
      { fingerprint: "4", date: "2026-03-10", label: "Loyer", amount: -900 },
      { fingerprint: "5", date: "2026-03-11", label: "Cafe", amount: -5 }
    ] as Transaction[];

    const days = computeCalendarSummary(transactions, "2026-03");

    expect(days[4].hasRecurring).toBe(true);
    expect(days[9].isHighExpenseDay).toBe(true);
  });

  it("detects explicit bank fees and ignores vague bank labels", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-03-01", label: "Frais tenue de compte", rawLabel: "FRAIS TENUE DE COMPTE", amount: -2.5 },
      { fingerprint: "2", date: "2026-03-02", label: "Commission intervention", rawLabel: "COMMISSION INTERVENTION", amount: -8 },
      { fingerprint: "3", date: "2026-03-03", label: "Agios", rawLabel: "AGIOS", amount: -4 },
      { fingerprint: "4", date: "2026-03-04", label: "Cotisation carte", rawLabel: "COTISATION CARTE", amount: -12 },
      { fingerprint: "5", date: "2026-03-05", label: "Banque alimentaire", rawLabel: "BANQUE ALIMENTAIRE", amount: -20 }
    ] as Transaction[];

    const fees = detectBankFees(transactions);

    expect(fees.map((fee) => fee.feeType)).toEqual(["cotisation carte", "agios", "commission", "tenue de compte"]);
    expect(fees.some((fee) => fee.transaction.label === "Banque alimentaire")).toBe(false);
  });

  it("detects recurring expenses across months and manual recurrences", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -9.99, recurrenceStatus: null },
      { fingerprint: "2", date: "2026-02-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -9.99, recurrenceStatus: null },
      { fingerprint: "3", date: "2026-03-15", label: "New SaaS", rawLabel: "NEW SAAS", amount: -19, recurrenceStatus: "manual", recurrenceId: "manual:3" }
    ] as Transaction[];

    const recurrences = detectRecurringExpenses(transactions);

    expect(recurrences.some((recurrence) => recurrence.label === "Spotify")).toBe(true);
    expect(recurrences.some((recurrence) => recurrence.status === "manual")).toBe(true);
  });

  it("groups manual recurring expenses with the same normalized merchant", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Netflix", rawLabel: "CB NETFLIX", amount: -13.49, recurrenceStatus: "manual", recurrenceId: "merchant:netflix" },
      { fingerprint: "2", date: "2026-02-05", label: "Netflix.com", rawLabel: "CB NETFLIX.COM", amount: -13.49, recurrenceStatus: null },
      { fingerprint: "3", date: "2026-03-05", label: "Netflix", rawLabel: "CB NETFLIX", amount: -13.49, recurrenceStatus: null }
    ] as Transaction[];

    const recurrences = detectRecurringExpenses(transactions);

    expect(recurrences).toHaveLength(1);
    expect(recurrences[0].normalizedLabel).toBe("netflix");
    expect(recurrences[0].status).toBe("manual");
    expect(recurrences[0].transactions.map((transaction) => transaction.fingerprint)).toEqual(["1", "2", "3"]);
  });

  it("keeps a single manually tracked recurring expense visible", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "New SaaS", rawLabel: "CB NEW SAAS", amount: -19, recurrenceStatus: "manual", recurrenceId: "merchant:new saas" }
    ] as Transaction[];

    const recurrences = detectRecurringExpenses(transactions);

    expect(recurrences).toHaveLength(1);
    expect(recurrences[0].status).toBe("manual");
  });

  it("computes monthly history and missing months between first and last occurrence", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Orange", rawLabel: "PRLV ORANGE", amount: -29.99 },
      { fingerprint: "2", date: "2026-02-05", label: "Orange", rawLabel: "PRLV ORANGE", amount: -29.99 },
      { fingerprint: "3", date: "2026-04-05", label: "Orange", rawLabel: "PRLV ORANGE", amount: -29.99 }
    ] as Transaction[];

    const recurrence = detectRecurringExpenses(transactions)[0];
    const metrics = computeRecurringExpenseMetrics(recurrence);

    expect(computeRecurringMonthlyHistory(transactions).map((month) => month.status)).toEqual(["present", "present", "missing", "present"]);
    expect(metrics.expectedMonthCount).toBe(4);
    expect(metrics.missingMonths).toEqual(["2026-03"]);
    expect(metrics.regularityRate).toBe(0.75);
  });

  it("detects recurring expenses with close monthly amounts", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Netflix", rawLabel: "CB NETFLIX", amount: -13.49 },
      { fingerprint: "2", date: "2026-02-06", label: "Netflix", rawLabel: "CB NETFLIX", amount: -14.49 },
      { fingerprint: "3", date: "2026-03-05", label: "Netflix", rawLabel: "CB NETFLIX", amount: -13.99 }
    ] as Transaction[];

    const recurrence = detectRecurringExpenses(transactions)[0];
    const metrics = computeRecurringExpenseMetrics(recurrence);

    expect(recurrence.label).toBe("Netflix");
    expect(metrics.averageDayOfMonth).toBeCloseTo(5.33);
    expect(metrics.monthlyEstimate).toBeCloseTo(13.99);
    expect(metrics.annualEstimate).toBeCloseTo(167.88);
    expect(metrics.amountVariation).toBeCloseTo(1 / 13.99);
  });

  it("does not detect a single punctual expense as recurring", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Electro Depot", rawLabel: "CB ELECTRO DEPOT", amount: -250 }
    ] as Transaction[];

    expect(detectRecurringExpenses(transactions)).toHaveLength(0);
  });

  it("computes recurring expense metrics for recurrence overview", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Spotify", rawLabel: "CB SPOTIFY", bankCategory: "Loisirs", amount: -9.99 },
      { fingerprint: "2", date: "2026-02-05", label: "Spotify", rawLabel: "CB SPOTIFY", bankCategory: "Loisirs", amount: -12.99 },
      { fingerprint: "3", date: "2026-03-05", label: "Spotify", rawLabel: "CB SPOTIFY", bankCategory: "Loisirs", amount: -10.99 }
    ] as Transaction[];

    const recurrence = detectRecurringExpenses(transactions)[0];
    const metrics = computeRecurringExpenseMetrics(recurrence);

    expect(metrics.category).toBe("Loisirs");
    expect(metrics.minAmount).toBe(9.99);
    expect(metrics.maxAmount).toBe(12.99);
    expect(metrics.annualEstimate).toBeCloseTo(135.88);
    expect(metrics.lastDate).toBe("2026-03-05");
    expect(metrics.occurrenceCount).toBe(3);
    expect(metrics.monthCount).toBe(3);
  });

  it("ignores transactions marked as false recurring positives", () => {
    const transactions = [
      { fingerprint: "1", date: "2026-01-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -9.99, recurrenceStatus: "ignored" },
      { fingerprint: "2", date: "2026-02-05", label: "Spotify", rawLabel: "CB SPOTIFY", amount: -9.99, recurrenceStatus: "ignored" }
    ] as Transaction[];

    expect(detectRecurringExpenses(transactions)).toHaveLength(0);
  });

  it("computes month comparison", () => {
    const transactions = [
      { date: "2026-01-05", label: "Cafe", bankCategory: "Loisirs", userCategory: null, amount: -10, isExcludedFromStats: false },
      { date: "2026-02-05", label: "Cafe", bankCategory: "Loisirs", userCategory: null, amount: -20, isExcludedFromStats: false },
      { date: "2026-02-06", label: "Train", bankCategory: "Transport", userCategory: null, amount: -30, isExcludedFromStats: false }
    ] as Transaction[];

    const comparison = computeMonthComparison(transactions, "2026-01", "2026-02");

    expect(comparison.secondStats.expenses).toBe(50);
    expect(comparison.categoryDeltas[0].name).toBe("Transport");
    expect(comparison.newExpenses[0].label).toBe("Train");
  });

  it("keeps special characters in labels", async () => {
    const content = [
      header,
      csvLine(["05/03/2026", "Paiement N° 123", "CB Café Été N° 123", "R1", "Référence l'été", "Carte", "Loisirs", "Café", "-3,20", "", "04/03/2026", "05/03/2026", ""])
    ].join("\n");

    const summary = await parseCaisseEpargneCsv(content, "special.csv");

    expect(summary.transactions[0].label).toBe("Paiement N° 123");
    expect(summary.transactions[0].rawLabel).toBe("CB Café Été N° 123");
  });
});
