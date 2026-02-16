export type DocStatus = "PENDIENTE" | "RECIBIDO";

export type ChecklistItem = {
  id: string;
  docKey: string;           // ej: FACTURA, RECIBO_TIMBRE, ...
  name_snapshot: string;
  required: boolean;
  status: DocStatus;
  received_at?: string | null;
};

export type FileRecord = {
  id: string;
  tramite_id: string;
  docKey: string;
  filename_original: string;
  uploaded_at: string;
  uploaded_by: string;
  version: number;
};

const checklistByTramite = new Map<string, ChecklistItem[]>();
const filesByTramite = new Map<string, FileRecord[]>();
const blobByFileId = new Map<string, File>();

function newId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function ensureMockDocs(tramiteId: string) {
  if (checklistByTramite.has(tramiteId)) return;

  const base: ChecklistItem[] = [
    { id: newId("D"), docKey: "FACTURA", name_snapshot: "Factura", required: true, status: "PENDIENTE", received_at: null },
    { id: newId("D"), docKey: "EVIDENCIA_PLACA", name_snapshot: "Evidencia de placa", required: false, status: "PENDIENTE", received_at: null },
    { id: newId("D"), docKey: "DOC_FISICO", name_snapshot: "Documentos físicos", required: true, status: "PENDIENTE", received_at: null },
    { id: newId("D"), docKey: "RECIBO_TIMBRE", name_snapshot: "Recibo timbre", required: true, status: "PENDIENTE", received_at: null },
    { id: newId("D"), docKey: "RECIBO_DERECHOS", name_snapshot: "Recibo derechos", required: true, status: "PENDIENTE", received_at: null },
    { id: newId("D"), docKey: "OTRO", name_snapshot: "Otro documento", required: false, status: "PENDIENTE", received_at: null },
  ];

  checklistByTramite.set(tramiteId, base);
  filesByTramite.set(tramiteId, []);
}

export function getMockChecklist(tramiteId: string): ChecklistItem[] {
  return checklistByTramite.get(tramiteId) ?? [];
}

export function getMockFiles(tramiteId: string): FileRecord[] {
  return filesByTramite.get(tramiteId) ?? [];
}

export function mockUploadFile(
  tramiteId: string,
  payload: { docKey: string; file: File; uploadedBy?: string }
): FileRecord {
  ensureMockDocs(tramiteId);

  const files = filesByTramite.get(tramiteId) ?? [];
  const lastVersion = Math.max(
    0,
    ...files.filter((f) => f.docKey === payload.docKey).map((f) => f.version)
  );

  const rec: FileRecord = {
    id: newId("F"),
    tramite_id: tramiteId,
    docKey: payload.docKey,
    filename_original: payload.file.name,
    uploaded_at: new Date().toISOString(),
    uploaded_by: payload.uploadedBy ?? "usuario",
    version: lastVersion + 1,
  };

  files.unshift(rec);
  filesByTramite.set(tramiteId, files);
  blobByFileId.set(rec.id, payload.file);

  // marca checklist como recibido
  const checklist = checklistByTramite.get(tramiteId) ?? [];
  const item = checklist.find((c) => c.docKey === payload.docKey);
  if (item) {
    item.status = "RECIBIDO";
    item.received_at = new Date().toISOString();
  }

  return rec;
}

export function mockDownloadFile(fileId: string): File | null {
  return blobByFileId.get(fileId) ?? null;
}
