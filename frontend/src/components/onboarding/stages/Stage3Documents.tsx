import { useCallback, useEffect, useMemo, useState } from "react";
import type { OnboardingData } from "@/src/hooks/useOnboardingForm";

const DOCUMENT_TYPES = [
  "PASSPORT",
  "EMIRATES_ID",
  "RESIDENCE_VISA",
  "LABOUR_CARD",
  "OFFER_LETTER",
  "SIGNED_CONTRACT",
  "MEDICAL_FITNESS",
  "BACKGROUND_CHECK",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

const DOC_LABELS: Record<DocumentType, string> = {
  PASSPORT: "Passport",
  EMIRATES_ID: "Emirates ID",
  RESIDENCE_VISA: "Residence Visa",
  LABOUR_CARD: "Labour Card",
  OFFER_LETTER: "Offer Letter",
  SIGNED_CONTRACT: "Signed Contract",
  MEDICAL_FITNESS: "Medical Fitness",
  BACKGROUND_CHECK: "Background Check",
};

type DocRow = {
  id: string;
  type: DocumentType;
  documentNumber?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
  uploadedAt?: string | null;
  uploadDeferredRemark?: string | null;
};

type UploadMode = "NOW" | "LATER";
type FieldState = { documentNumber: string; expiryDate: string; mode: UploadMode; deferRemark: string };

const REQUIRED_DOC_TYPES: DocumentType[] = ["PASSPORT", "EMIRATES_ID"];

export function Stage3Documents({
  data,
  updateField,
  draftId,
  onStatus,
}: {
  data: OnboardingData;
  updateField: <K extends keyof OnboardingData>(field: K, value: OnboardingData[K]) => void;
  draftId: string | null;
  onStatus?: (message: string) => void;
}) {
  const [files, setFiles] = useState<Record<DocumentType, File | null>>({
    PASSPORT: null,
    EMIRATES_ID: null,
    RESIDENCE_VISA: null,
    LABOUR_CARD: null,
    OFFER_LETTER: null,
    SIGNED_CONTRACT: null,
    MEDICAL_FITNESS: null,
    BACKGROUND_CHECK: null,
  });
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [deferringType, setDeferringType] = useState<DocumentType | null>(null);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [selectedExtraType, setSelectedExtraType] = useState<DocumentType>("RESIDENCE_VISA");
  const [activeTypes, setActiveTypes] = useState<DocumentType[]>(REQUIRED_DOC_TYPES);
  const [fieldsByType, setFieldsByType] = useState<Record<DocumentType, FieldState>>({
    PASSPORT: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    EMIRATES_ID: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    RESIDENCE_VISA: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    LABOUR_CARD: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    OFFER_LETTER: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    SIGNED_CONTRACT: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    MEDICAL_FITNESS: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
    BACKGROUND_CHECK: { documentNumber: "", expiryDate: "", mode: "NOW", deferRemark: "" },
  });

  const loadDocs = useCallback(async () => {
    if (!draftId) return;
    const response = await fetch(`/api/employees/${draftId}/documents`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to fetch uploaded docs");
    setDocs(Array.isArray(payload) ? payload : []);
  }, [draftId]);

  useEffect(() => {
    loadDocs().catch(() => {});
  }, [loadDocs]);

  const docsByType = useMemo(
    () =>
      docs.reduce<Record<DocumentType, DocRow | undefined>>((bucket, doc) => {
        bucket[doc.type] = doc;
        return bucket;
      }, {} as Record<DocumentType, DocRow | undefined>),
    [docs],
  );

  useEffect(() => {
    setFieldsByType((prev) => {
      const next = { ...prev };
      for (const type of DOCUMENT_TYPES) {
        const doc = docsByType[type];
        if (!doc) continue;
        next[type] = {
          documentNumber:
            type === "PASSPORT"
              ? data.passportNumber
              : type === "EMIRATES_ID"
                ? data.emiratesIdNumber
                : (doc.documentNumber ?? prev[type].documentNumber ?? ""),
          expiryDate:
            type === "PASSPORT"
              ? data.passportExpiry
              : type === "EMIRATES_ID"
                ? data.emiratesIdExpiry
                : (doc.expiryDate ? String(doc.expiryDate).slice(0, 10) : prev[type].expiryDate ?? ""),
          mode: doc.fileUrl ? "NOW" : doc.uploadDeferredRemark ? "LATER" : prev[type].mode,
          deferRemark: doc.uploadDeferredRemark ?? prev[type].deferRemark ?? "",
        };
      }
      return next;
    });
  }, [data.emiratesIdExpiry, data.emiratesIdNumber, data.passportExpiry, data.passportNumber, docsByType]);

  useEffect(() => {
    const existingTypes = docs.map((doc) => doc.type).filter((type): type is DocumentType => DOCUMENT_TYPES.includes(type));
    setActiveTypes((prev) => Array.from(new Set([...REQUIRED_DOC_TYPES, ...prev, ...existingTypes])));
  }, [docs]);

  async function upload(type: DocumentType) {
    if (!draftId) {
      onStatus?.("Please save previous stage first so a draft employee ID is created.");
      return;
    }

    const file = files[type];
    if (!file) {
      onStatus?.(`Please choose a file for ${DOC_LABELS[type]}.`);
      return;
    }

    const field = fieldsByType[type];
    setUploadingType(type);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("file", file);
      if (field.documentNumber.trim()) form.set("documentNumber", field.documentNumber.trim());
      if (field.expiryDate) form.set("expiryDate", field.expiryDate);

      const response = await fetch(`/api/employees/${draftId}/documents`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Upload failed");

      setFiles((prev) => ({ ...prev, [type]: null }));
      await loadDocs();
      onStatus?.(`${DOC_LABELS[type]} uploaded successfully.`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploadingType(null);
    }
  }

  async function saveDeferral(type: DocumentType) {
    if (!draftId) {
      onStatus?.("Please save previous stage first so a draft employee ID is created.");
      return;
    }

    const remark = fieldsByType[type].deferRemark.trim();
    if (remark.length < 3) {
      onStatus?.("Enter a remark of at least 3 characters explaining why the upload is deferred.");
      return;
    }

    setDeferringType(type);
    try {
      const form = new FormData();
      form.set("type", type);
      form.set("deferOnly", "true");
      form.set("deferRemark", remark);
      if (fieldsByType[type].documentNumber.trim()) form.set("documentNumber", fieldsByType[type].documentNumber.trim());
      if (fieldsByType[type].expiryDate) form.set("expiryDate", fieldsByType[type].expiryDate);

      const response = await fetch(`/api/employees/${draftId}/documents`, { method: "POST", body: form });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "Could not save deferral");

      await loadDocs();
      onStatus?.(`${DOC_LABELS[type]} marked for upload later.`);
    } catch (error) {
      onStatus?.(error instanceof Error ? error.message : "Could not save deferral");
    } finally {
      setDeferringType(null);
    }
  }

  function updateDocFields(type: DocumentType, patch: Partial<FieldState>) {
    setFieldsByType((prev) => ({ ...prev, [type]: { ...prev[type], ...patch } }));
  }

  function addMoreDocument() {
    if (activeTypes.includes(selectedExtraType)) return;
    setActiveTypes((prev) => [...prev, selectedExtraType]);
  }

  function removeOptionalDocument(type: DocumentType) {
    if (REQUIRED_DOC_TYPES.includes(type)) return;
    setActiveTypes((prev) => prev.filter((item) => item !== type));
  }

  function documentRow(type: DocumentType) {
    const doc = docsByType[type];
    const field = fieldsByType[type];
    const hasFile = doc?.fileUrl != null && String(doc.fileUrl).trim().length > 0;
    const hasDefer = doc?.uploadDeferredRemark != null && String(doc.uploadDeferredRemark).trim().length > 0 && !hasFile;
    const isRequired = REQUIRED_DOC_TYPES.includes(type);
    const isLaterMode = field.mode === "LATER";

    return (
      <div key={type} className="rounded border border-slate-200 bg-white p-3">
        <div className="grid gap-2 md:grid-cols-[180px_1fr_170px_210px_auto] md:items-center">
          <p className="text-sm font-medium">{DOC_LABELS[type]}</p>
          <input
            className="rounded border p-2 text-sm"
            placeholder="Document no."
            value={field.documentNumber}
            onChange={(e) => {
              const nextValue = e.target.value;
              updateDocFields(type, { documentNumber: nextValue });
              if (type === "PASSPORT") updateField("passportNumber", nextValue);
              if (type === "EMIRATES_ID") updateField("emiratesIdNumber", nextValue);
            }}
          />
          <input
            className="rounded border p-2 text-sm"
            type="date"
            value={field.expiryDate}
            onChange={(e) => {
              const nextValue = e.target.value;
              updateDocFields(type, { expiryDate: nextValue });
              if (type === "PASSPORT") updateField("passportExpiry", nextValue);
              if (type === "EMIRATES_ID") updateField("emiratesIdExpiry", nextValue);
            }}
          />
          <div className="inline-flex rounded border p-1 text-xs">
            <button
              type="button"
              className={`rounded px-2 py-1 ${!isLaterMode ? "bg-slate-900 text-white" : "text-slate-700"}`}
              onClick={() => updateDocFields(type, { mode: "NOW" })}
            >
              Upload now
            </button>
            <button
              type="button"
              className={`rounded px-2 py-1 ${isLaterMode ? "bg-slate-900 text-white" : "text-slate-700"}`}
              onClick={() => updateDocFields(type, { mode: "LATER" })}
            >
              Upload later
            </button>
          </div>
          {!isRequired ? (
            <button
              type="button"
              className="rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => removeOptionalDocument(type)}
            >
              Remove
            </button>
          ) : (
            <span />
          )}
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
          {isLaterMode ? (
            <input
              key={`${type}-later`}
              className="rounded border p-2 text-sm"
              placeholder="Reason for upload later..."
              value={field.deferRemark}
              onChange={(e) => updateDocFields(type, { deferRemark: e.target.value })}
            />
          ) : (
            <input
              key={`${type}-now`}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              className="w-full rounded border p-2 text-sm"
              onChange={(e) => setFiles((prev) => ({ ...prev, [type]: e.target.files?.[0] ?? null }))}
            />
          )}
          {isLaterMode ? (
            <button
              type="button"
              className="rounded border border-amber-600 bg-white px-3 py-1 text-sm text-amber-900 disabled:opacity-50"
              disabled={deferringType === type}
              onClick={() => saveDeferral(type)}
            >
              {deferringType === type ? "Saving..." : "Save later"}
            </button>
          ) : (
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-1 text-sm text-white disabled:opacity-60"
              onClick={() => upload(type)}
              disabled={uploadingType === type}
            >
              {uploadingType === type ? "Uploading..." : "Upload"}
            </button>
          )}
        </div>

        {hasFile ? (
          <a href={doc?.fileUrl ?? "#"} target="_blank" rel="noreferrer" className="mt-2 block text-xs text-blue-600 underline">
            View uploaded file
          </a>
        ) : null}
        {hasDefer ? (
          <div className="mt-2 rounded border border-amber-200 bg-amber-50/80 p-2 text-xs text-amber-950">
            <p className="font-medium">Upload later note</p>
            <p className="mt-1 whitespace-pre-wrap">{doc?.uploadDeferredRemark}</p>
          </div>
        ) : null}
      </div>
    );
  }

  const addableTypes = DOCUMENT_TYPES.filter((type) => !activeTypes.includes(type));

  return (
    <div className="space-y-4">
      <div className="rounded border bg-slate-50 p-3 text-xs text-slate-600">
        Each document row has `Document no.`, `Expiry date`, and toggle for `Upload now` / `Upload later`.
      </div>

      <div className="space-y-3">
        {activeTypes.map((type) => documentRow(type))}
      </div>

      {addableTypes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded border border-dashed p-3">
          <select
            className="min-w-60 rounded border p-2 text-sm"
            value={selectedExtraType}
            onChange={(e) => setSelectedExtraType(e.target.value as DocumentType)}
          >
            {addableTypes.map((type) => (
              <option key={type} value={type}>
                {DOC_LABELS[type]}
              </option>
            ))}
          </select>
          <button type="button" className="rounded border px-3 py-2 text-sm" onClick={addMoreDocument}>
            Add more document
          </button>
        </div>
      ) : null}
    </div>
  );
}
