import { useEffect, useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable
} from "@tanstack/react-table";
import { Check, ChevronDown, Circle, EyeOff, MoreHorizontal, X } from "lucide-react";
import { detectRecurringExpenses } from "../lib/analysis";
import { formatCurrency, formatDate } from "../lib/format";
import type { Transaction } from "../lib/types";

type Props = {
  transactions: Transaction[];
  userCategories: string[];
  categorySuggestions?: string[];
  onUpdateTransaction: (fingerprint: string, patch: Partial<Transaction>) => Promise<void>;
  variant?: "compact" | "full";
  initialPageSize?: number;
};

export function TransactionsTable({
  transactions,
  userCategories,
  categorySuggestions = userCategories,
  onUpdateTransaction,
  variant = "compact",
  initialPageSize = 8
}: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "date", desc: true }]);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const autoRecurringFingerprints = useMemo(() => {
    const fingerprints = new Set<string>();

    for (const recurrence of detectRecurringExpenses(transactions)) {
      if (recurrence.status !== "detected") continue;
      for (const transaction of recurrence.transactions) {
        fingerprints.add(transaction.fingerprint);
      }
    }

    return fingerprints;
  }, [transactions]);
  const pageSizeOptions = Array.from(new Set([initialPageSize, 10, 25, 50, 100])).filter(
    (size) => size <= Math.max(transactions.length, initialPageSize)
  );

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: "date",
        header: "Date",
        cell: ({ row }) => formatDate(row.original.date)
      },
      {
        accessorKey: "label",
        header: "Libelle",
        cell: ({ row }) => (
          <button className="label-cell label-cell-button" type="button" onClick={() => setSelectedTransaction(row.original)}>
            <strong>{row.original.label}</strong>
            <span>
              {row.original.rawLabel}
              {row.original.recurrenceStatus === "manual" || autoRecurringFingerprints.has(row.original.fingerprint) ? (
                <em className="recurrence-badge manual">Recurrent</em>
              ) : null}
              {row.original.recurrenceStatus === "ignored" ? <em className="recurrence-badge ignored">Ignore</em> : null}
            </span>
          </button>
        )
      },
      {
        accessorKey: "bankCategory",
        header: "Categorie",
        cell: ({ row }) => (
          <span className="category-pill">
            <span className="category-dot" />
            {row.original.userCategory || row.original.bankCategory || "-"}
          </span>
        )
      },
      ...(variant === "full"
        ? [
            {
              accessorKey: "bankSubcategory",
              header: "Sous-categorie",
              cell: ({ row }) => row.original.bankSubcategory ?? "-"
            } satisfies ColumnDef<Transaction>
          ]
        : []),
      {
        accessorKey: "operationType",
        header: "Type"
      },
      {
        accessorKey: "userCategory",
        header: "Categorie perso",
        cell: ({ row }) => (
          <EditableCategoryCell
            transaction={row.original}
            categorySuggestions={categorySuggestions}
            onUpdateTransaction={onUpdateTransaction}
          />
        )
      },
      {
        accessorKey: "debit",
        header: "Debit",
        cell: ({ row }) => <span>{row.original.debit ? formatCurrency(row.original.debit) : "-"}</span>
      },
      {
        accessorKey: "credit",
        header: "Credit",
        cell: ({ row }) => <span className="positive">{row.original.credit ? formatCurrency(row.original.credit) : "-"}</span>
      },
      {
        accessorKey: "amount",
        header: "Montant",
        cell: ({ row }) => (
          <strong className={row.original.amount >= 0 ? "positive" : "negative"}>{formatCurrency(row.original.amount)}</strong>
        )
      },
      {
        accessorKey: "userNotes",
        header: "Note",
        cell: ({ row }) => (
          <DeferredTextInput
            value={row.original.userNotes ?? ""}
            placeholder="Annoter"
            onCommit={(value) => void onUpdateTransaction(row.original.fingerprint, { userNotes: value || null })}
          />
        )
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="row-actions">
            <button
              type="button"
              className={row.original.isChecked ? "action active" : "action"}
              title="Pointer"
              onClick={() => void onUpdateTransaction(row.original.fingerprint, { isChecked: !row.original.isChecked })}
            >
              {row.original.isChecked ? <Check size={16} /> : <Circle size={16} />}
            </button>
            <button
              type="button"
              className={row.original.isExcludedFromStats ? "action active" : "action"}
              title="Exclure des stats"
              onClick={() =>
                void onUpdateTransaction(row.original.fingerprint, {
                  isExcludedFromStats: !row.original.isExcludedFromStats
                })
              }
            >
              <EyeOff size={16} />
            </button>
            <button type="button" className="action" title="Plus" onClick={() => setSelectedTransaction(row.original)}>
              <MoreHorizontal size={16} />
            </button>
          </div>
        )
      }
    ],
    [autoRecurringFingerprints, categorySuggestions, onUpdateTransaction, variant]
  );

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize
      }
    }
  });

  return (
    <>
      <datalist id="user-categories">
        {categorySuggestions.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>
      <div className="table-page-size">
        <span>Lignes par page</span>
        <select
          value={pageSize}
          onChange={(event) => {
            const nextSize = Number(event.target.value);
            setPageSize(nextSize);
            table.setPageSize(nextSize);
          }}
        >
          {pageSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
          <option value={transactions.length || 1}>Toutes</option>
        </select>
      </div>
      <div className={`table-wrap table-wrap-${variant}`}>
        <table className={`transactions-table transactions-table-${variant}`}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id}>
                    <button type="button" onClick={header.column.getToggleSortingHandler()}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? " ↑" : header.column.getIsSorted() === "desc" ? " ↓" : ""}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-state">
                  Aucun resultat.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="pagination">
        <button type="button" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
          Precedent
        </button>
        <span>
          Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
        </span>
        <button type="button" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
          Suivant
        </button>
      </div>
      {selectedTransaction ? (
        <TransactionDrawer
          transaction={selectedTransaction}
          isAutoRecurring={autoRecurringFingerprints.has(selectedTransaction.fingerprint)}
          categorySuggestions={categorySuggestions}
          onClose={() => setSelectedTransaction(null)}
          onUpdate={(patch) => {
            setSelectedTransaction({ ...selectedTransaction, ...patch });
            void onUpdateTransaction(selectedTransaction.fingerprint, patch);
          }}
        />
      ) : null}
    </>
  );
}

function TransactionDrawer({
  transaction,
  isAutoRecurring,
  categorySuggestions,
  onClose,
  onUpdate
}: {
  transaction: Transaction;
  isAutoRecurring: boolean;
  categorySuggestions: string[];
  onClose: () => void;
  onUpdate: (patch: Partial<Transaction>) => void;
}) {
  const isRecurring = transaction.recurrenceStatus === "manual" || isAutoRecurring;

  return (
    <div className="drawer-backdrop" role="dialog" aria-modal="true">
      <aside className="transaction-drawer">
        <div className="drawer-header">
          <div>
            <h2>{transaction.label}</h2>
            <p>{transaction.rawLabel}</p>
          </div>
          <button className="ghost-button" type="button" onClick={onClose} aria-label="Fermer">
            <X size={16} />
          </button>
        </div>

        <div className="drawer-actions">
          <button type="button" className="filter-button" onClick={() => onUpdate({ isChecked: !transaction.isChecked })}>
            {transaction.isChecked ? "Depointer" : "Pointer"}
          </button>
          <button type="button" className="filter-button" onClick={() => onUpdate({ isExcludedFromStats: !transaction.isExcludedFromStats })}>
            {transaction.isExcludedFromStats ? "Reinclure" : "Exclure des stats"}
          </button>
          <label className="toggle-control">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(event) =>
                onUpdate(
                  event.target.checked
                    ? { recurrenceStatus: "manual", recurrenceId: `manual:${transaction.fingerprint}` }
                    : {
                        recurrenceStatus: transaction.recurrenceStatus === "manual" ? null : "ignored",
                        recurrenceId: null
                      }
                )
              }
            />
            <span>Recurrent</span>
          </label>
        </div>

        <label className="drawer-field">
          <span>Categorie banque</span>
          <CategoryPicker value={transaction.bankCategory ?? ""} suggestions={categorySuggestions} onCommit={(value) => onUpdate({ bankCategory: value || null })} />
        </label>
        <label className="drawer-field">
          <span>Categorie perso</span>
          <CategoryPicker value={transaction.userCategory ?? ""} suggestions={categorySuggestions} onCommit={(value) => onUpdate({ userCategory: value || null })} />
        </label>
        <label className="drawer-field">
          <span>Note</span>
          <DeferredTextInput value={transaction.userNotes ?? ""} onCommit={(value) => onUpdate({ userNotes: value || null })} />
        </label>

        <div className="drawer-details">
          <Detail label="Date operation" value={transaction.operationDate} />
          <Detail label="Date comptable" value={transaction.bookingDate} />
          <Detail label="Date valeur" value={transaction.valueDate} />
          <Detail label="Type" value={transaction.operationType} />
          <Detail label="Categorie banque originale" value={transaction.raw?.["Categorie"] ?? null} />
          <Detail label="Sous-categorie" value={transaction.bankSubcategory} />
          <Detail label="Reference" value={transaction.reference} />
          <Detail label="Notes CSV" value={transaction.notes} />
          <Detail label="Montant" value={formatCurrency(transaction.amount)} />
          <Detail label="Fingerprint" value={transaction.fingerprint} />
        </div>
      </aside>
    </div>
  );
}

function DeferredTextInput({
  value,
  list,
  placeholder,
  onCommit
}: {
  value: string;
  list?: string;
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelNextCommitRef = useRef(false);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  function commit() {
    if (cancelNextCommitRef.current) {
      cancelNextCommitRef.current = false;
      setDraft(value);
      return;
    }

    const nextValue = draft.trim();
    if (nextValue !== value) {
      onCommit(nextValue);
    }
  }

  return (
    <input
      className="table-input"
      list={list}
      value={draft}
      placeholder={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") {
          cancelNextCommitRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

function EditableCategoryCell({
  transaction,
  categorySuggestions,
  onUpdateTransaction
}: {
  transaction: Transaction;
  categorySuggestions: string[];
  onUpdateTransaction: (fingerprint: string, patch: Partial<Transaction>) => Promise<void>;
}) {
  return (
    <CategoryPicker
      value={transaction.userCategory ?? ""}
      suggestions={categorySuggestions}
      placeholder="Ajouter"
      onCommit={(value) => void onUpdateTransaction(transaction.fingerprint, { userCategory: value || null })}
    />
  );
}

function CategoryPicker({
  value,
  suggestions,
  placeholder,
  onCommit
}: {
  value: string;
  suggestions: string[];
  placeholder?: string;
  onCommit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const normalizedDraft = draft.trim().toLowerCase();
  const options = suggestions
    .filter((category) => category.trim())
    .filter((category, index, all) => all.findIndex((candidate) => candidate.toLowerCase() === category.toLowerCase()) === index)
    .filter((category) => !normalizedDraft || category.toLowerCase().includes(normalizedDraft) || category === value)
    .slice(0, 12);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function commit(nextValue = draft) {
    const cleaned = nextValue.trim();
    if (cleaned !== value) onCommit(cleaned);
  }

  return (
    <div className="category-picker" ref={rootRef}>
      <input
        className="table-input category-picker-input"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => {
          setDraft(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onBlur={() => commit()}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(value);
            setIsOpen(false);
            event.currentTarget.blur();
          }
        }}
      />
      <button
        className="category-picker-toggle"
        type="button"
        title="Choisir une categorie"
        aria-label="Choisir une categorie"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ChevronDown size={14} />
      </button>
      {isOpen ? (
        <div className="category-picker-menu">
          {options.length > 0 ? (
            options.map((category) => (
              <button
                key={category}
                type="button"
                className={category === value ? "active" : ""}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setDraft(category);
                  setIsOpen(false);
                  commit(category);
                }}
              >
                {category}
              </button>
            ))
          ) : (
            <span>Aucune categorie</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="drawer-detail">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}
