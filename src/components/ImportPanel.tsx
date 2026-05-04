import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import { formatCurrency } from "../lib/format";
import type { CsvSource, ImportSummary } from "../lib/types";

type Props = {
  preview: ImportSummary | null;
  lastImport: ImportSummary | null;
  onImport: (summary: ImportSummary) => Promise<void>;
  onCancel: () => void;
};

export function ImportPanel({ preview, lastImport, onImport, onCancel }: Props) {
  const summary = preview ?? lastImport;
  if (!summary) return null;

  return (
    <section className={`import-panel ${preview ? "is-preview" : ""}`}>
      <div className="panel-title">
        <div>
          <p className="eyebrow">{preview ? "Apercu import" : "Dernier import"}</p>
          <h2>{summary.importRecord.fileName}</h2>
          <span className="source-chip">{sourceLabel(summary.importRecord.source)}</span>
        </div>
        {preview ? (
          <button className="ghost-button" type="button" onClick={onCancel} aria-label="Fermer l'apercu">
            <X size={16} />
          </button>
        ) : null}
      </div>

      <div className="import-grid">
        <Metric label="Lignes" value={summary.importRecord.rowsCount.toString()} />
        <Metric label="Valides" value={summary.importRecord.validRowsCount.toString()} tone="positive" />
        <Metric label="Doublons" value={summary.importRecord.duplicateRowsCount.toString()} />
        <Metric label="Erreurs" value={summary.importRecord.errorRowsCount.toString()} tone="negative" />
        <Metric label="Credits" value={formatCurrency(summary.importRecord.totalCredit)} tone="positive" />
        <Metric label="Debits" value={formatCurrency(summary.importRecord.totalDebit)} tone="negative" />
      </div>

      {preview ? (
        <div className="import-confirm">
          {preview.missingColumns.length > 0 ? (
            <p className="warning">
              <AlertTriangle size={16} />
              Colonnes manquantes: {preview.missingColumns.join(", ")}
            </p>
          ) : (
            <p className="success">
              <CheckCircle2 size={16} />
              Apercu pret pour import.
            </p>
          )}
          <button
            className="primary-button"
            type="button"
            disabled={preview.missingColumns.length > 0}
            onClick={() => {
              void onImport(preview);
            }}
          >
            Confirmer l'import
          </button>
        </div>
      ) : null}
    </section>
  );
}

function sourceLabel(source: CsvSource) {
  return source === "trade-republic" ? "Trade Republic" : "Caisse d'Epargne";
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  );
}
