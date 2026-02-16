import type { TramiteEstado } from "./types";

export type EstadoHistItem = {
  id: string;
  tramite_id: string;
  from_estado: TramiteEstado | null;
  to_estado: TramiteEstado;
  changed_at: string; // ISO
  changed_by: string;
  notes?: string | null;
  action_type: "NORMAL" | "REABRIR" | "CANCELAR" | "FINALIZAR";
};

const currentEstadoByTramite = new Map<string, TramiteEstado>();
const histByTramite = new Map<string, EstadoHistItem[]>();

function newHistId() {
  return `H-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function getMockEstado(tramiteId: string, fallback: TramiteEstado): TramiteEstado {
  return currentEstadoByTramite.get(tramiteId) ?? fallback;
}

export function setMockEstado(tramiteId: string, estado: TramiteEstado) {
  currentEstadoByTramite.set(tramiteId, estado);
}

export function ensureMockHist(tramiteId: string, initialEstado: TramiteEstado, createdAt?: string) {
  if (histByTramite.has(tramiteId)) return;

  const first: EstadoHistItem = {
    id: newHistId(),
    tramite_id: tramiteId,
    from_estado: null,
    to_estado: initialEstado,
    changed_at: createdAt ?? new Date().toISOString(),
    changed_by: "sistema",
    notes: "Creación del trámite",
    action_type: "NORMAL",
  };

  histByTramite.set(tramiteId, [first]);
  currentEstadoByTramite.set(tramiteId, initialEstado);
}

export function getMockHist(tramiteId: string): EstadoHistItem[] {
  return histByTramite.get(tramiteId) ?? [];
}

export function appendMockHist(params: {
  tramiteId: string;
  from: TramiteEstado;
  to: TramiteEstado;
  notes?: string;
  actionType?: EstadoHistItem["action_type"];
  changedBy?: string;
}) {
  const list = histByTramite.get(params.tramiteId) ?? [];
  const item: EstadoHistItem = {
    id: newHistId(),
    tramite_id: params.tramiteId,
    from_estado: params.from,
    to_estado: params.to,
    changed_at: new Date().toISOString(),
    changed_by: params.changedBy ?? "usuario",
    notes: params.notes ?? null,
    action_type: params.actionType ?? "NORMAL",
  };

  list.unshift(item); // más reciente arriba
  histByTramite.set(params.tramiteId, list);
  currentEstadoByTramite.set(params.tramiteId, params.to);
}
