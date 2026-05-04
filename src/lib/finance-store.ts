import { invoke } from "@tauri-apps/api/core";
import { cleanText, computeSignedAmount, hasAmount, parseFrenchAmount } from "./csv-import";
import type { FinanceStore } from "./types";

const browserStoreKey = "finance-dashboard-store";

export function createEmptyStore(): FinanceStore {
  return {
    version: 2,
    transactions: [],
    imports: [],
    userCategories: [],
    budgets: [],
    updatedAt: new Date().toISOString()
  };
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadStore(): Promise<FinanceStore> {
  let loadedStore: unknown;

  if (isTauriRuntime()) {
    loadedStore = await invoke("load_store");
    return normalizeStoreAmounts(migrateFinanceStore(loadedStore));
  }

  const raw = window.localStorage.getItem(browserStoreKey);
  if (!raw) return createEmptyStore();
  loadedStore = JSON.parse(raw);
  return normalizeStoreAmounts(migrateFinanceStore(loadedStore));
}

export async function saveStore(store: FinanceStore): Promise<void> {
  const nextStore = { ...store, updatedAt: new Date().toISOString() };

  if (isTauriRuntime()) {
    await invoke("save_store", { store: nextStore });
    return;
  }

  window.localStorage.setItem(browserStoreKey, JSON.stringify(nextStore));
}

export function mergeImportedTransactions(
  store: FinanceStore,
  transactions: FinanceStore["transactions"],
  importRecord: FinanceStore["imports"][number]
): FinanceStore {
  const existingFingerprints = new Set(store.transactions.map((transaction) => transaction.fingerprint));
  const nextTransactions = [
    ...store.transactions,
    ...transactions.filter((transaction) => !existingFingerprints.has(transaction.fingerprint))
  ].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  return {
    ...store,
    transactions: nextTransactions,
    imports: [importRecord, ...store.imports],
    updatedAt: new Date().toISOString()
  };
}

export function removeUserCategory(store: FinanceStore, category: string): FinanceStore {
  const normalizedCategory = category.trim();
  if (!normalizedCategory) return store;

  const now = new Date().toISOString();

  return {
    ...store,
    transactions: store.transactions.map((transaction) =>
      transaction.userCategory === normalizedCategory
        ? { ...transaction, userCategory: null, updatedAt: now }
        : transaction
    ),
    userCategories: store.userCategories.filter((userCategory) => userCategory !== normalizedCategory),
    updatedAt: now
  };
}

export function migrateFinanceStore(store: unknown): FinanceStore {
  const fallback = createEmptyStore();
  if (!store || typeof store !== "object") return fallback;
  const rawStore = store as Partial<FinanceStore> & { version?: number };

  return {
    version: 2,
    transactions: Array.isArray(rawStore.transactions) ? rawStore.transactions : [],
    imports: Array.isArray(rawStore.imports) ? rawStore.imports : [],
    userCategories: Array.isArray(rawStore.userCategories) ? rawStore.userCategories : [],
    budgets: Array.isArray(rawStore.budgets) ? rawStore.budgets : [],
    updatedAt: typeof rawStore.updatedAt === "string" ? rawStore.updatedAt : fallback.updatedAt
  };
}

export function normalizeStoreAmounts(store: FinanceStore): FinanceStore {
  return {
    ...store,
    transactions: store.transactions.map((transaction) => {
      const rawDebit = transaction.raw?.["Debit"];
      const rawCredit = transaction.raw?.["Credit"];
      const cleanedTextFields = {
        label: cleanText(transaction.label),
        rawLabel: transaction.rawLabel ? cleanText(transaction.rawLabel) : transaction.rawLabel,
        reference: transaction.reference ? cleanText(transaction.reference) : transaction.reference,
        notes: transaction.notes ? cleanText(transaction.notes) : transaction.notes,
        operationType: transaction.operationType ? cleanText(transaction.operationType) : transaction.operationType,
        bankCategory: transaction.bankCategory ? cleanText(transaction.bankCategory) : transaction.bankCategory,
        bankSubcategory: transaction.bankSubcategory ? cleanText(transaction.bankSubcategory) : transaction.bankSubcategory,
        userCategory: transaction.userCategory ? cleanText(transaction.userCategory) : transaction.userCategory,
        userNotes: transaction.userNotes ? cleanText(transaction.userNotes) : transaction.userNotes,
        raw: Object.fromEntries(Object.entries(transaction.raw ?? {}).map(([key, value]) => [cleanText(key).trim(), cleanText(value)]))
      };

      if (!hasAmount(rawDebit) && !hasAmount(rawCredit)) return { ...transaction, ...cleanedTextFields };

      const debit = parseFrenchAmount(rawDebit);
      const credit = parseFrenchAmount(rawCredit);
      const amount = computeSignedAmount(debit, credit, hasAmount(rawDebit), hasAmount(rawCredit));

      if (transaction.debit === debit && transaction.credit === credit && transaction.amount === amount) {
        return { ...transaction, ...cleanedTextFields };
      }

      return {
        ...transaction,
        ...cleanedTextFields,
        debit,
        credit,
        amount
      };
    })
  };
}
