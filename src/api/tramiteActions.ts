import { api } from "./http";
import { withFallback } from "./fallback";
import type { TramiteEstado } from "./types";

export type ActionResponse = { ok: true };

export async function finalizarTramite(id: string): Promise<ActionResponse> {
  return withFallback(
    async () => {
      await api.post(`/tramites/${id}/finalizar`, {}, { headers: { Accept: "application/json" } });
      return { ok: true };
    },
    () => ({ ok: true }),
    (d) => !!d && (d as any).ok === true
  );
}

export async function cancelarTramite(id: string, reason?: string): Promise<ActionResponse> {
  return withFallback(
    async () => {
      await api.post(
        `/tramites/${id}/cancelar`,
        { reason },
        { headers: { Accept: "application/json" } }
      );
      return { ok: true };
    },
    () => ({ ok: true }),
    (d) => !!d && (d as any).ok === true
  );
}

export async function reabrirTramite(
  id: string,
  payload: { reason: string; toEstado?: TramiteEstado }
): Promise<ActionResponse> {
  return withFallback(
    async () => {
      await api.post(`/tramites/${id}/reabrir`, payload, { headers: { Accept: "application/json" } });
      return { ok: true };
    },
    () => ({ ok: true }),
    (d) => !!d && (d as any).ok === true
  );
}
