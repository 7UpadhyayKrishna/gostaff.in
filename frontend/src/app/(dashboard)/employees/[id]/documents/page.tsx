"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/src/components/layout/PageHeader";

type DocumentRow = {
  id: string;
  type: string;
  status: string;
  documentNumber?: string | null;
  expiryDate?: string | null;
  fileUrl?: string | null;
};

export default function Page() {
  const params = useParams<{ id: string }>();
  const [docs, setDocs] = useState<DocumentRow[]>([]);
  const [error, setError] = useState("");
  const [docType, setDocType] = useState("PASSPORT");
  const [expiryDate, setExpiryDate] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDocs = useCallback(async () => {
    const response = await fetch(`/api/employees/${params.id}/documents`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error ?? "Unable to load documents");
    setDocs(Array.isArray(payload) ? payload : []);
  }, [params.id]);

  useEffect(() => {
    loadDocs().catch((e) => setError(e instanceof Error ? e.message : "Unable to load documents"));
  }, [loadDocs]);

  async function addDoc() {
    if (!file) {
      setError("Please choose a file to upload.");
      return;
    }
    setSubmitting(true);
    setError("");
    const form = new FormData();
    form.set("type", docType);
    form.set("documentNumber", documentNumber);
    if (expiryDate) form.set("expiryDate", expiryDate);
    form.set("file", file);

    const response = await fetch(`/api/employees/${params.id}/documents`, {
      method: "POST",
      body: form,
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to add document");
      setSubmitting(false);
      return;
    }
    setDocumentNumber("");
    setExpiryDate("");
    setFile(null);
    await loadDocs();
    setSubmitting(false);
  }

  async function verify(docId: string, status: "CLEARED" | "FAILED" | "EXPIRING_SOON") {
    const response = await fetch(`/api/employees/${params.id}/documents/${docId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();
    if (!response.ok) {
      setError(payload?.error ?? "Unable to update document");
      return;
    }
    await loadDocs();
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Document Verification" subtitle="Approve, reject, or mark documents for reupload." />
      {error ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">{error}</div> : null}

      <div className="grid gap-2 rounded border p-3 md:grid-cols-5">
        <select className="rounded border p-2 text-sm" value={docType} onChange={(e) => setDocType(e.target.value)}>
          <option value="PASSPORT">Passport</option>
          <option value="EMIRATES_ID">Emirates ID</option>
          <option value="RESIDENCE_VISA">Residence Visa</option>
          <option value="LABOUR_CARD">Labour Card</option>
        </select>
        <input
          className="rounded border p-2 text-sm"
          placeholder="Document number"
          value={documentNumber}
          onChange={(e) => setDocumentNumber(e.target.value)}
        />
        <input className="rounded border p-2 text-sm" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        <input
          className="rounded border p-2 text-sm"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
        />
        <button className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-60" onClick={addDoc} disabled={submitting}>
          {submitting ? "Uploading..." : "Add Document"}
        </button>
      </div>

      <div className="overflow-hidden rounded border">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-left">Number</th>
              <th className="p-2 text-left">Expiry</th>
              <th className="p-2 text-left">Status</th>
              <th className="p-2 text-left">File</th>
              <th className="p-2 text-left">Verification</th>
            </tr>
          </thead>
          <tbody>
            {docs.map((doc) => (
              <tr key={doc.id} className="border-t">
                <td className="p-2">{doc.type}</td>
                <td className="p-2">{doc.documentNumber || "-"}</td>
                <td className="p-2">{doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "-"}</td>
                <td className="p-2">{doc.status}</td>
                <td className="p-2">
                  {doc.fileUrl ? (
                    <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      View
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-2">
                    <button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={() => verify(doc.id, "CLEARED")}>Approve</button>
                    <button className="rounded bg-amber-500 px-2 py-1 text-xs text-white" onClick={() => verify(doc.id, "EXPIRING_SOON")}>Need Reupload</button>
                    <button className="rounded bg-rose-600 px-2 py-1 text-xs text-white" onClick={() => verify(doc.id, "FAILED")}>Reject</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {docs.length === 0 ? <p className="text-sm text-slate-500">No documents found for this employee.</p> : null}
    </div>
  );
}
