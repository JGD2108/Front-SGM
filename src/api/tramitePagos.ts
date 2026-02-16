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

function looksLikePayment(x: any): x is PaymentRecord {
  return (
    x &&
    typeof x.id === "string" &&
    typeof x.tramite_id === "string" &&
    typeof x.type === "string" &&
    typeof x.valor === "number" &&
    typeof x.fecha === "string"
  );
}

function looksLikePaymentArray(x: any): x is PaymentRecord[] {
  return Array.isArray(x) && x.every((p) => typeof p?.id === "string");
}

export async function getPayments(tramiteId: string): Promise<PaymentRecord[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/${tramiteId}/payments`, {
        headers: { Accept: "application/json" },
      });

      const data = res.data;

      // ✅ si te devolvió HTML, forzamos fallback
      if (isHtml(data)) throw new Error("HTML_RESPONSE");

      // ✅ si no es array de pagos, fallback
      if (!looksLikePaymentArray(data)) throw new Error("INVALID_PAYMENTS");

      return data;
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
    cuenta?: string;
    notes?: string;
    attachment?: File | null;
  }
): Promise<PaymentRecord> {
  return withFallback(
    async () => {
      const hasAttachment = !!payload.attachment;

      if (hasAttachment) {
        const form = new FormData();
        form.append("tipo", payload.type);
        form.append("valor", String(payload.valor));
        form.append("fecha", new Date(payload.fecha).toISOString());
        if (payload.medio_pago) form.append("medio_pago", payload.medio_pago);
        if (payload.cuenta) form.append("cuenta", payload.cuenta);
        form.append("notes", payload.notes ?? "");
        form.append("attachment", payload.attachment!);

        const res = await api.post(`/tramites/${tramiteId}/payments`, form, {
          headers: { "Content-Type": "multipart/form-data", Accept: "application/json" },
        });

        const data = res.data;
        if (isHtml(data)) throw new Error("HTML_RESPONSE");
        if (!looksLikePayment(data)) throw new Error("INVALID_CREATE_PAYMENT");
        return data;
      }

      const res = await api.post(
        `/tramites/${tramiteId}/payments`,
        {
          tipo: payload.type,
          valor: payload.valor,
          fecha: new Date(payload.fecha).toISOString(),
          medio_pago: payload.medio_pago,
          cuenta: payload.cuenta,
          notes: payload.notes ?? "",
        },
        { headers: { Accept: "application/json" } }
      );

      const data = res.data;
      if (isHtml(data)) throw new Error("HTML_RESPONSE");
      if (!looksLikePayment(data)) throw new Error("INVALID_CREATE_PAYMENT");
      return data;
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
        medio_pago: payload.medio_pago ?? null,
        cuenta: payload.cuenta ?? null,
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
      // si backend no devuelve nada, igual aceptamos (pero si te da HTML, cae al mock)
      return { ok: true };
    },
    () => {
      deleteMockPayment(tramiteId, paymentId);
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}
