import { api } from "./http";
import { withFallback } from "./fallback";
import {
  addMockPayment,
  deleteMockPayment,
  ensureMockPayments,
  getMockPayments,
  type PaymentRecord,
  type PaymentType,
} from "./mockPaymentsState";
import { mockUploadFile } from "./mockDocsState";

function isHtml(data: any) {
  return typeof data === "string" && data.toLowerCase().includes("<!doctype html");
}

function normalizePaymentType(raw: unknown): PaymentType | null {
  const t = String(raw ?? "").toUpperCase();
  if (t === "TIMBRE" || t === "DERECHOS" || t === "OTRO") return t;
  return null;
}

function normalizePayment(x: any, tramiteId: string): PaymentRecord | null {
  if (!x || typeof x.id !== "string") return null;

  const type = normalizePaymentType(x.type ?? x.tipo);
  if (!type) return null;

  const valor = Number(x.valor ?? 0);
  if (!Number.isFinite(valor)) return null;

  const fechaRaw = x.fecha ?? x.created_at ?? new Date().toISOString();

  return {
    id: x.id,
    tramite_id: String(x.tramite_id ?? x.tramiteId ?? tramiteId),
    type,
    valor,
    fecha: String(fechaRaw),
    medio_pago: x.medio_pago ?? x.medioPago ?? null,
    cuenta: x.cuenta ?? null,
    notes: x.notes ?? null,
    attachment_file_id: x.attachment_file_id ?? x.attachmentFileId ?? null,
    attachment_name: x.attachment_name ?? x.attachmentName ?? null,
    created_at: String(x.created_at ?? new Date().toISOString()),
  };
}

export async function getPayments(tramiteId: string): Promise<PaymentRecord[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/${tramiteId}/payments`, {
        headers: { Accept: "application/json" },
        // Avoid stale cached responses in Electron/Chromium.
        params: { _ts: Date.now() },
      });

      const data = res.data;
      if (isHtml(data)) throw new Error("HTML_RESPONSE");

      // Backend can return array or { items: [...] }.
      const rawList = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
      if (!rawList) throw new Error("INVALID_PAYMENTS");

      const list = rawList
        .map((p: any) => normalizePayment(p, tramiteId))
        .filter((p: PaymentRecord | null): p is PaymentRecord => !!p);

      if (rawList.length > 0 && list.length === 0) throw new Error("INVALID_PAYMENTS_SHAPE");
      return list;
    },
    () => {
      ensureMockPayments(tramiteId);
      return getMockPayments(tramiteId);
    },
    (d) => Array.isArray(d)
  );
}

export async function createPayment(
  tramiteId: string,
  payload: {
    type: PaymentType;
    valor: number;
    fecha: string;
    medio_pago?: string;
    medioPago?: string;
    notes?: string;
    attachment?: File | null;
  }
): Promise<PaymentRecord> {
  const medioPago = payload.medio_pago ?? payload.medioPago;

  return withFallback(
    async () => {
      const hasAttachment = !!payload.attachment;

      if (hasAttachment) {
        const form = new FormData();
        form.append("tipo", payload.type);
        form.append("valor", String(payload.valor));
        form.append("fecha", new Date(payload.fecha).toISOString());
        if (medioPago) form.append("medio_pago", medioPago);
        form.append("notes", payload.notes ?? "");
        form.append("attachment", payload.attachment!);

        const res = await api.post(`/tramites/${tramiteId}/payments`, form, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        });

        const data = res.data;
        if (isHtml(data)) throw new Error("HTML_RESPONSE");
        const rec = normalizePayment(data, tramiteId);
        if (!rec) throw new Error("INVALID_CREATE_PAYMENT");
        return rec;
      }

      const res = await api.post(
        `/tramites/${tramiteId}/payments`,
        {
          tipo: payload.type,
          valor: payload.valor,
          fecha: new Date(payload.fecha).toISOString(),
          medio_pago: medioPago,
          notes: payload.notes ?? "",
        },
        { headers: { Accept: "application/json" } }
      );

      const data = res.data;
      if (isHtml(data)) throw new Error("HTML_RESPONSE");
      const rec = normalizePayment(data, tramiteId);
      if (!rec) throw new Error("INVALID_CREATE_PAYMENT");
      return rec;
    },
    () => {
      let attachment_file_id: string | null = null;
      let attachment_name: string | null = null;

      if (payload.attachment) {
        const rec = mockUploadFile(tramiteId, {
          docKey: `PAGO_${payload.type}`,
          file: payload.attachment,
          uploadedBy: "usuario",
        });
        attachment_file_id = rec.id;
        attachment_name = payload.attachment.name;
      }

      return addMockPayment(tramiteId, {
        tramite_id: tramiteId,
        type: payload.type,
        valor: payload.valor,
        fecha: payload.fecha,
        medio_pago: medioPago ?? null,
        notes: payload.notes ?? null,
        attachment_file_id,
        attachment_name,
      });
    },
    (d) => !!d && typeof (d as any).id === "string"
  );
}

export async function deletePayment(tramiteId: string, paymentId: string): Promise<{ ok: true }> {
  return withFallback(
    async () => {
      const res = await api.delete(`/tramites/${tramiteId}/payments/${paymentId}`, {
        headers: { Accept: "application/json" },
      });

      const data = res.data;
      if (isHtml(data)) throw new Error("HTML_RESPONSE");
      // If backend returns empty body, still treat as success.
      return { ok: true };
    },
    () => {
      deleteMockPayment(tramiteId, paymentId);
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}
