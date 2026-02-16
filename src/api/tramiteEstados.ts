import { api } from "./http";
import { withFallback } from "./fallback";
import type { TramiteEstado } from "./types";
import { appendMockHist, ensureMockHist, getMockEstado, getMockHist } from "./mockState";

export type EstadoHistItem = {
  id: string;
  tramite_id: string;
  from_estado: TramiteEstado | null;
  to_estado: TramiteEstado;
  changed_at: string;
  changed_by: string;
  notes?: string | null;
  action_type: "NORMAL" | "REABRIR" | "CANCELAR" | "FINALIZAR";
};

function looksValidHist(data: any): data is EstadoHistItem[] {
  return Array.isArray(data);
}

export async function getEstadoHist(tramiteId: string): Promise<EstadoHistItem[]> {
  return withFallback(
    async () => {
      // ✅ RUTA REAL
      const res = await api.get(`/tramites/${tramiteId}/estados/historial`, {
        headers: { Accept: "application/json" },
      });
      const data = res.data;
      if (!looksValidHist(data)) throw new Error("INVALID_HIST");
      return data;
    },
    () => {
      ensureMockHist(tramiteId, "FACTURA_RECIBIDA");
      return getMockHist(tramiteId);
    },
    looksValidHist
  );
}

export async function changeEstado(
  tramiteId: string,
  payload: { toEstado: TramiteEstado; notes?: string; placa?: string }
): Promise<{ ok: true }> {
  return withFallback(
    async () => {
      // ✅ RUTA REAL
      await api.post(
        `/tramites/${tramiteId}/estado`,
        { toEstado: payload.toEstado, notes: payload.notes, placa: payload.placa },
        { headers: { Accept: "application/json" } }
      );
      return { ok: true };
    },
    () => {
      ensureMockHist(tramiteId, "FACTURA_RECIBIDA");
      const from = getMockEstado(tramiteId, "FACTURA_RECIBIDA");
      appendMockHist({
        tramiteId,
        from,
        to: payload.toEstado,
        notes: payload.notes,
        actionType: "NORMAL",
      });
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}
