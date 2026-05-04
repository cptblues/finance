import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  CreditCard,
  Download,
  FileDown,
  Flag,
  Goal,
  HelpCircle,
  Home,
  Layers3,
  PiggyBank,
  ReceiptText,
  RefreshCw,
  Search,
  Settings,
  Upload
} from "lucide-react";
import { check } from "@tauri-apps/plugin-updater";
import { ActiveFilters } from "./components/ActiveFilters";
import { FilterBar } from "./components/FilterBar";
import { applyFilters, defaultFilters, getAvailableMonths, normalizeMerchantLabel } from "./lib/analysis";
import { parseBankCsv } from "./lib/csv-import";
import { createEmptyStore, loadStore, mergeImportedTransactions, migrateFinanceStore, removeUserCategory, saveStore } from "./lib/finance-store";
import { formatDate } from "./lib/format";
import type { Budget, CsvSource, DashboardFilters, FinanceStore, ImportSummary, Transaction } from "./lib/types";

type ActiveView = "dashboard" | "transactions" | "categories" | "budgets" | "recurring" | "analysis" | "imports";

const Dashboard = lazy(() => import("./components/Dashboard").then((module) => ({ default: module.Dashboard })));
const AnalysisPage = lazy(() => import("./components/AnalysisPage").then((module) => ({ default: module.AnalysisPage })));
const BudgetsPage = lazy(() => import("./components/BudgetsPage").then((module) => ({ default: module.BudgetsPage })));
const CategoriesPage = lazy(() => import("./components/CategoriesPage").then((module) => ({ default: module.CategoriesPage })));
const ImportPanel = lazy(() => import("./components/ImportPanel").then((module) => ({ default: module.ImportPanel })));
const RecurringPage = lazy(() => import("./components/RecurringPage").then((module) => ({ default: module.RecurringPage })));
const TransactionsTable = lazy(() => import("./components/TransactionsTable").then((module) => ({ default: module.TransactionsTable })));

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function App() {
  const [store, setStore] = useState<FinanceStore>(createEmptyStore);
  const [filters, setFilters] = useState<DashboardFilters>(defaultFilters);
  const [lastImport, setLastImport] = useState<ImportSummary | null>(null);
  const [previewImport, setPreviewImport] = useState<ImportSummary | null>(null);
  const [status, setStatus] = useState("Chargement des donnees locales...");
  const [activeView, setActiveView] = useState<ActiveView>("dashboard");
  const [importSource, setImportSource] = useState<CsvSource>("caisse-epargne");

  useEffect(() => {
    loadStore()
      .then((loadedStore) => {
        setStore(loadedStore);
        setStatus("Pret");
      })
      .catch(() => {
        setStatus("Impossible de charger le fichier local, demarrage avec un espace vide.");
      });
  }, []);

  const filteredTransactions = useMemo(
    () => applyFilters(store.transactions, filters),
    [store.transactions, filters]
  );
  const dashboardTransactions = useMemo(
    () => applyFilters(store.transactions, { ...filters, startDate: "", endDate: "" }),
    [store.transactions, filters]
  );
  const availableMonths = useMemo(() => getAvailableMonths(store.transactions), [store.transactions]);
  const categorySuggestions = useMemo(() => {
    const categories = store.transactions.flatMap((transaction) => [
      transaction.bankCategory,
      transaction.userCategory
    ]);

    return Array.from(new Set([...store.userCategories, ...categories].filter(Boolean) as string[])).sort();
  }, [store.transactions, store.userCategories]);
  const selectedMonth = availableMonths.find((month) => month.startDate === filters.startDate && month.endDate === filters.endDate)?.value ?? "";
  const periodLabel = useMemo(() => getPeriodLabel(filteredTransactions), [filteredTransactions]);
  const viewTitle =
    activeView === "transactions"
      ? "Transactions"
      : activeView === "categories"
        ? "Categories"
        : activeView === "budgets"
          ? "Budgets"
          : activeView === "recurring"
            ? "Recurrents"
            : activeView === "analysis"
              ? "Analyses"
              : activeView === "imports"
                ? "Imports"
                : "Dashboard financier";

  async function persist(nextStore: FinanceStore) {
    setStore(nextStore);
    await saveStore(nextStore);
  }

  async function handleImport(summary: ImportSummary) {
    const nextStore = mergeImportedTransactions(store, summary.transactions, summary.importRecord);
    await persist(nextStore);
    setLastImport(summary);
    setPreviewImport(null);
    setStatus(
      `${summary.importRecord.validRowsCount} transaction(s) ajoutee(s), ${summary.importRecord.duplicateRowsCount} doublon(s) ignore(s).`
    );
  }

  async function previewCsv(file: File) {
    setStatus("Analyse du CSV...");
    const summary = await parseBankCsv(
      await readCsvFile(file),
      file.name,
      importSource,
      new Set(store.transactions.map((transaction) => transaction.fingerprint))
    );
    setPreviewImport(summary);
    setStatus(`Apercu ${sourceLabel(summary.importRecord.source)} pret.`);
  }

  async function updateTransaction(fingerprint: string, patch: Partial<Transaction>) {
    const now = new Date().toISOString();
    const targetTransaction = store.transactions.find((transaction) => transaction.fingerprint === fingerprint);
    const targetMerchant = targetTransaction ? normalizeMerchantLabel(targetTransaction.rawLabel || targetTransaction.label) : "";
    const isManualRecurrencePatch = patch.recurrenceStatus === "manual";
    const isManualRecurrenceRemoval =
      patch.recurrenceStatus === null && patch.recurrenceId === null && targetTransaction?.recurrenceStatus === "manual";
    const recurrencePatch = isManualRecurrencePatch && targetMerchant ? { ...patch, recurrenceId: `merchant:${targetMerchant}` } : patch;
    const nextTransactions = store.transactions.map((transaction) => {
      const merchant = normalizeMerchantLabel(transaction.rawLabel || transaction.label);
      const shouldUpdate =
        transaction.fingerprint === fingerprint ||
        ((isManualRecurrencePatch || isManualRecurrenceRemoval) &&
          transaction.amount < 0 &&
          transaction.recurrenceStatus !== "ignored" &&
          merchant === targetMerchant);

      return shouldUpdate ? { ...transaction, ...recurrencePatch, updatedAt: now } : transaction;
    });
    const nextStore = {
      ...store,
      transactions: nextTransactions,
      userCategories:
        typeof patch.userCategory === "string" && patch.userCategory.trim()
          ? Array.from(
              new Set<string>([
                ...store.userCategories,
                ...(store.transactions.map((transaction) => transaction.bankCategory).filter(Boolean) as string[]),
                patch.userCategory.trim()
              ])
            ).sort()
          : store.userCategories
    };
    await persist(nextStore);
  }

  async function updateTransactions(fingerprints: string[], patch: Partial<Transaction>) {
    const now = new Date().toISOString();
    const fingerprintSet = new Set(fingerprints);
    const nextTransactions = store.transactions.map((transaction) =>
      fingerprintSet.has(transaction.fingerprint) ? { ...transaction, ...patch, updatedAt: now } : transaction
    );
    const nextStore = {
      ...store,
      transactions: nextTransactions,
      userCategories:
        typeof patch.userCategory === "string" && patch.userCategory.trim()
          ? Array.from(new Set([...store.userCategories, patch.userCategory.trim()])).sort()
          : store.userCategories
    };
    await persist(nextStore);
  }

  async function deleteUserCategory(category: string) {
    await persist(removeUserCategory(store, category));
    setStatus(`Categorie "${category}" supprimee des transactions.`);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finance-dashboard-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    const parsed = migrateFinanceStore(JSON.parse(await file.text()));
    if (!Array.isArray(parsed.transactions)) {
      setStatus("Fichier JSON invalide.");
      return;
    }
    await persist(parsed);
    setStatus(`${parsed.transactions.length} transaction(s) restauree(s).`);
  }

  async function resetStore() {
    const nextStore = createEmptyStore();
    await persist(nextStore);
    setLastImport(null);
    setPreviewImport(null);
    setStatus("Espace local reinitialise.");
  }

  async function checkForUpdate() {
    if (!isTauriRuntime()) {
      setStatus("Les mises a jour sont disponibles uniquement dans l'application desktop installee.");
      return;
    }

    setStatus("Recherche de mise a jour...");

    try {
      const update = await check();
      if (!update) {
        setStatus("Application a jour.");
        return;
      }

      setStatus(`Mise a jour ${update.version} trouvee, telechargement...`);
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") setStatus("Telechargement de la mise a jour...");
        if (event.event === "Finished") setStatus("Installation de la mise a jour...");
      });
      setStatus("Mise a jour installee. Redemarre l'application pour finaliser.");
    } catch (error) {
      setStatus(error instanceof Error ? `Mise a jour impossible: ${error.message}` : "Mise a jour impossible.");
    }
  }

  async function createBudget(category: string, monthlyAmount: number) {
    const now = new Date().toISOString();
    const existing = store.budgets.find((budget) => budget.category === category);
    const nextBudgets = existing
      ? store.budgets.map((budget) => (budget.id === existing.id ? { ...budget, monthlyAmount, updatedAt: now } : budget))
      : [
          ...store.budgets,
          {
            id: createLocalId(),
            category,
            monthlyAmount,
            createdAt: now,
            updatedAt: now
          }
        ];
    await persist({ ...store, budgets: nextBudgets });
    setStatus(`Budget "${category}" enregistre.`);
  }

  async function updateBudget(id: string, patch: Partial<Budget>) {
    const now = new Date().toISOString();
    await persist({
      ...store,
      budgets: store.budgets.map((budget) => (budget.id === id ? { ...budget, ...patch, updatedAt: now } : budget))
    });
  }

  async function deleteBudget(id: string) {
    await persist({ ...store, budgets: store.budgets.filter((budget) => budget.id !== id) });
    setStatus("Budget supprime.");
  }

  return (
    <main className="desktop-stage">
      <div className="app-window">
        <aside className="sidebar">
          <div className="window-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="brand">
            <Home size={20} />
            <span>Mes Finances</span>
          </div>
          <nav className="side-nav" aria-label="Navigation principale">
            <SideItem icon={<Home size={18} />} label="Dashboard" active={activeView === "dashboard"} onClick={() => setActiveView("dashboard")} />
            <SideItem
              icon={<ReceiptText size={18} />}
              label="Transactions"
              active={activeView === "transactions"}
              onClick={() => setActiveView("transactions")}
            />
            <SideItem
              icon={<Layers3 size={18} />}
              label="Categories"
              active={activeView === "categories"}
              onClick={() => setActiveView("categories")}
            />
            <SideItem icon={<PiggyBank size={18} />} label="Budgets" active={activeView === "budgets"} onClick={() => setActiveView("budgets")} />
            <SideItem icon={<BarChart3 size={18} />} label="Analyses" active={activeView === "analysis"} onClick={() => setActiveView("analysis")} />
            <SideItem icon={<FileDown size={18} />} label="Imports" active={activeView === "imports"} onClick={() => setActiveView("imports")} />
          </nav>
          <nav className="side-nav side-nav-secondary" aria-label="Navigation secondaire">
            <SideItem icon={<CreditCard size={18} />} label="Comptes" disabled />
            <SideItem icon={<RefreshCw size={18} />} label="Recurrents" active={activeView === "recurring"} onClick={() => setActiveView("recurring")} />
            <SideItem icon={<Goal size={18} />} label="Objectifs" disabled />
          </nav>
          <nav className="side-nav side-nav-secondary" aria-label="Aide et parametres">
            <SideItem icon={<Settings size={18} />} label="Parametres" disabled />
            <SideItem icon={<HelpCircle size={18} />} label="Aide & support" disabled />
          </nav>
          <div className="profile-card">
            <span>JD</span>
            <div>
              <strong>Julien Dupont</strong>
              <small>local</small>
            </div>
          </div>
        </aside>

        <section className="content-shell">
          <header className="topbar">
            <h1>{viewTitle}</h1>
            <div className="topbar-actions">
              <select
                className="month-select"
                value={selectedMonth}
                onChange={(event) => {
                  const month = availableMonths.find((item) => item.value === event.target.value);
                  setFilters(month ? { ...filters, startDate: month.startDate, endDate: month.endDate } : { ...filters, startDate: "", endDate: "" });
                }}
              >
                <option value="">Tous les mois</option>
                {availableMonths.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
              <div className="period-control">
                <CalendarDays size={16} />
                <span>{periodLabel}</span>
              </div>
              <label className="top-search">
                <Search size={17} />
                <input
                  value={filters.search}
                  placeholder="Rechercher..."
                  onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                />
              </label>
              <select
                className="month-select"
                value={importSource}
                onChange={(event) => setImportSource(event.target.value as CsvSource)}
                aria-label="Profil d'import CSV"
              >
                <option value="caisse-epargne">Caisse d'Epargne</option>
                <option value="trade-republic">Trade Republic</option>
              </select>
              <label className="import-button">
                <Upload size={17} />
                <span>Importer un CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void previewCsv(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
          </header>

          <section className="status-row">
            <span>{status}</span>
            <span>{store.transactions.length} transaction(s)</span>
            <span>{store.imports.length} import(s)</span>
            <label className="status-action" title="Importer une sauvegarde JSON">
              <Upload size={15} />
              <input
                type="file"
                accept="application/json"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void importJson(file);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <button className="status-action" type="button" onClick={exportJson} title="Exporter la sauvegarde JSON">
              <Download size={15} />
            </button>
            <button className="status-action" type="button" onClick={() => void checkForUpdate()} title="Rechercher une mise a jour">
              <RefreshCw size={15} />
            </button>
            <button className="status-action" type="button" onClick={resetStore} title="Reinitialiser les donnees locales">
              <RefreshCw size={15} />
            </button>
          </section>
          <ActiveFilters filters={filters} onChange={setFilters} />

          <Suspense fallback={<ViewLoading />}>
            {activeView === "imports" || previewImport ? (
              <ImportPanel preview={previewImport} lastImport={lastImport} onImport={handleImport} onCancel={() => setPreviewImport(null)} />
            ) : null}

            {activeView === "dashboard" ? (
              <>
                <Dashboard transactions={dashboardTransactions} selectedMonth={selectedMonth || null} />
                <TransactionsSection
                  title="Transactions recentes"
                  transactions={filteredTransactions}
                  userCategories={store.userCategories}
                  categorySuggestions={categorySuggestions}
                  filters={filters}
                  store={store}
                  onFiltersChange={setFilters}
                  onUpdateTransaction={updateTransaction}
                  variant="compact"
                  initialPageSize={8}
                />
              </>
            ) : null}

            {activeView === "transactions" ? (
              <TransactionsSection
                title="Toutes les transactions"
                transactions={filteredTransactions}
                userCategories={store.userCategories}
                categorySuggestions={categorySuggestions}
                filters={filters}
                store={store}
                onFiltersChange={setFilters}
                onUpdateTransaction={updateTransaction}
                variant="full"
                initialPageSize={25}
              />
            ) : null}

            {activeView === "categories" ? (
              <CategoriesPage
                transactions={filteredTransactions}
                userCategories={store.userCategories}
                categorySuggestions={categorySuggestions}
                onUpdateTransaction={updateTransaction}
                onDeleteUserCategory={deleteUserCategory}
              />
            ) : null}

            {activeView === "budgets" ? (
              <BudgetsPage
                transactions={store.transactions}
                budgets={store.budgets}
                categorySuggestions={categorySuggestions}
                selectedMonth={selectedMonth || null}
                onCreateBudget={createBudget}
                onUpdateBudget={updateBudget}
                onDeleteBudget={deleteBudget}
              />
            ) : null}

            {activeView === "recurring" ? (
              <RecurringPage
                transactions={filteredTransactions}
                userCategories={store.userCategories}
                categorySuggestions={categorySuggestions}
                onUpdateTransaction={updateTransaction}
                onUpdateTransactions={updateTransactions}
              />
            ) : null}

            {activeView === "analysis" ? <AnalysisPage transactions={store.transactions} /> : null}

            {activeView === "imports" ? (
              <section className="panel imports-page">
                <div className="chart-title">
                  <h2>Historique des imports</h2>
                </div>
                <div className="storage-info">
                  <div>
                    <strong>Stockage local</strong>
                    <span>
                      Les transactions importees sont conservees dans la sauvegarde locale de l'application. Chaque transaction garde aussi sa ligne CSV brute dans
                      le champ raw.
                    </span>
                  </div>
                  <div>
                    <strong>Sauvegarde JSON</strong>
                    <span>
                      Le bouton Exporter telecharge une copie restaurable dans le dossier choisi par ton systeme. Reinitialiser vide les transactions, imports,
                      categories perso et budgets.
                    </span>
                  </div>
                </div>
                {store.imports.length > 0 ? (
                  <div className="imports-list">
                    {store.imports.map((importRecord) => (
                      <div key={importRecord.id} className="import-row">
                        <strong>{importRecord.fileName}</strong>
                        <span>{sourceLabel(importRecord.source)}</span>
                        <span>{importRecord.validRowsCount} transaction(s)</span>
                        <span>{importRecord.duplicateRowsCount} doublon(s)</span>
                        <span>{formatDate(importRecord.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">Aucun import confirme.</div>
                )}
              </section>
            ) : null}
          </Suspense>
        </section>
      </div>
    </main>
  );
}

function ViewLoading() {
  return <div className="panel empty-state">Chargement de la vue...</div>;
}

async function readCsvFile(file: File) {
  const buffer = await file.arrayBuffer();
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  if (!utf8.includes("\uFFFD")) return utf8;
  return new TextDecoder("windows-1252").decode(buffer);
}

function SideItem({
  icon,
  label,
  active,
  disabled,
  onClick
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button className={`side-item ${active ? "active" : ""}`} type="button" disabled={disabled} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TransactionsSection({
  title,
  transactions,
  userCategories,
  categorySuggestions,
  filters,
  store,
  onFiltersChange,
  onUpdateTransaction,
  variant,
  initialPageSize
}: {
  title: string;
  transactions: Transaction[];
  userCategories: string[];
  categorySuggestions: string[];
  filters: DashboardFilters;
  store: FinanceStore;
  onFiltersChange: (filters: DashboardFilters) => void;
  onUpdateTransaction: (fingerprint: string, patch: Partial<Transaction>) => Promise<void>;
  variant: "compact" | "full";
  initialPageSize: number;
}) {
  return (
    <section className={`transactions-section ${variant === "full" ? "transactions-section-full" : ""}`}>
      <div className="transactions-head">
        <h2>{title}</h2>
        <FilterBar transactions={store.transactions} filters={filters} onChange={onFiltersChange} />
      </div>
      <div className="table-toolbar">
        <span>{transactions.length} transaction(s)</span>
        <span>Mis a jour {formatDate(store.updatedAt)}</span>
        <Flag size={15} />
      </div>
      <TransactionsTable
        transactions={transactions}
        userCategories={userCategories}
        categorySuggestions={categorySuggestions}
        onUpdateTransaction={onUpdateTransaction}
        variant={variant}
        initialPageSize={initialPageSize}
      />
    </section>
  );
}

function getPeriodLabel(transactions: Transaction[]) {
  const dates = transactions.map((transaction) => transaction.date).filter(Boolean).sort() as string[];
  if (!dates.length) return "Aucune periode";
  return `${formatDate(dates[0])} - ${formatDate(dates[dates.length - 1])}`;
}

function sourceLabel(source: CsvSource) {
  return source === "trade-republic" ? "Trade Republic" : "Caisse d'Epargne";
}

function createLocalId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `local-${Date.now()}`;
}
