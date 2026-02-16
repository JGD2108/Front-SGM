// src/api/tramiteDocumentos.ts
import { api } from "./http";
import { withFallback } from "./fallback";
import { USE_MOCKS } from "./config";

export type ChecklistStatus = "PENDIENTE" | "RECIBIDO";

export type ChecklistItem = {
  id: string;
  docKey: string;
  label: string;
  required: boolean;
  status: ChecklistStatus;
  updated_at?: string;
};

export type TramiteFileItem = {
  id: string;
  tramite_id?: string;
  docKey: string;
  filename: string;
  mime?: string;
  size?: number;
  created_at: string;
};

type UploadDocInput = {
  docKey: string;
  file: File;
};

// =====================
// Mock store interno (no depende de mockDocsState.ts)
// =====================
const mockChecklistByTramite = new Map<string, ChecklistItem[]>();
const mockFilesByTramite = new Map<string, TramiteFileItem[]>();

function nowIso() {
  return new Date().toISOString();
}

function ensureMockChecklist(tramiteId: string) {
  if (mockChecklistByTramite.has(tramiteId)) return;

  // ✅ Lista base mínima (ajústala si quieres más docs)
  mockChecklistByTramite.set(tramiteId, [
    {
      id: `chk-${tramiteId}-FACTURA`,
      docKey: "FACTURA",
      label: "Factura",
      required: true,
      status: "PENDIENTE",
      updated_at: nowIso(),
    },
    {
      id: `chk-${tramiteId}-DOCS_FISICOS`,
      docKey: "DOCS_FISICOS",
      label: "Documentos físicos",
      required: false,
      status: "PENDIENTE",
      updated_at: nowIso(),
    },
  ]);
}

function ensureMockFiles(tramiteId: string) {
  if (mockFilesByTramite.has(tramiteId)) return;
  mockFilesByTramite.set(tramiteId, []);
}

function markChecklistRecibido(tramiteId: string, docKey: string) {
  ensureMockChecklist(tramiteId);
  const list = mockChecklistByTramite.get(tramiteId)!;
  const i = list.findIndex((x) => x.docKey === docKey);
  if (i >= 0) {
    list[i] = { ...list[i], status: "RECIBIDO", updated_at: nowIso() };
  } else {
    list.push({
      id: `chk-${tramiteId}-${docKey}`,
      docKey,
      label: docKey,
      required: false,
      status: "RECIBIDO",
      updated_at: nowIso(),
    });
  }
  mockChecklistByTramite.set(tramiteId, list);
}

function addMockFile(tramiteId: string, docKey: string, file: File) {
  ensureMockFiles(tramiteId);
  const files = mockFilesByTramite.get(tramiteId)!;

  files.unshift({
    id: `F-${Date.now()}`,
    tramite_id: tramiteId,
    docKey,
    filename: file.name,
    mime: file.type,
    size: file.size,
    created_at: nowIso(),
  });

  mockFilesByTramite.set(tramiteId, files);
  markChecklistRecibido(tramiteId, docKey);
}

// =====================
// Helpers de validación (backend puede devolver array o {items})
// =====================
function asArrayItems<T>(data: any): T[] | null {
  if (Array.isArray(data)) return data as T[];
  if (data && Array.isArray(data.items)) return data.items as T[];
  return null;
}

// =====================
// API
// =====================

export async function getChecklist(tramiteId: string): Promise<ChecklistItem[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/${tramiteId}/checklist`, {
        headers: { Accept: "application/json" },
      });
      const arr = asArrayItems<ChecklistItem>(res.data);
      if (!arr) throw new Error("INVALID_CHECKLIST");
      return arr;
    },
    () => {
      ensureMockChecklist(tramiteId);
      return mockChecklistByTramite.get(tramiteId)!;
    },
    (d) => Array.isArray(asArrayItems<ChecklistItem>(d))
  );
}

export async function getTramiteFiles(tramiteId: string): Promise<TramiteFileItem[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/${tramiteId}/files`, {
        headers: { Accept: "application/json" },
      });
      const arr = asArrayItems<TramiteFileItem>(res.data);
      if (!arr) throw new Error("INVALID_FILES");
      return arr;
    },
    () => {
      ensureMockFiles(tramiteId);
      return mockFilesByTramite.get(tramiteId)!;
    },
    (d) => Array.isArray(asArrayItems<TramiteFileItem>(d))
  );
}

export async function uploadTramiteFile(tramiteId: string, input: UploadDocInput): Promise<{ ok: true }> {
  return withFallback(
    async () => {
      const fd = new FormData();
      fd.append("docKey", input.docKey);
      fd.append("file", input.file); // ✅ backend espera "file"

      await api.post(`/tramites/${tramiteId}/files`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      return { ok: true };
    },
    () => {
      // mocks
      addMockFile(tramiteId, input.docKey, input.file);
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}

/**
 * ✅ ESTA es la función que te falta y que DocumentosTab está importando:
 * Descarga un archivo por su fileId
 * Endpoint backend: GET /files/:id/download
 */
export async function downloadFile(fileId: string): Promise<Blob> {
  return withFallback(
    async () => {
      const res = await api.get(`/files/${fileId}/download`, {
        responseType: "blob",
      });
      const blob = res.data as Blob;
      if (!blob || typeof (blob as any).size !== "number") throw new Error("INVALID_BLOB");
      return blob;
    },
    () => {
      // mocks: retorna un "pdf" fake para probar
      const content = `MOCK FILE ${fileId}\n${new Date().toISOString()}`;
      return new Blob([content], { type: "application/pdf" });
    },
    (d) => !!d && typeof (d as any).size === "number"
  );
}
