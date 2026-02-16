import type { TramiteListItem, TramiteEstado } from "./types";

const created = new Map<string, TramiteListItem>();

export function addMockTramite(t: TramiteListItem) {
  created.set(t.id, t);
}

export function getMockTramite(id: string): TramiteListItem | null {
  return created.get(id) ?? null;
}

export function listAllMockTramites(base: TramiteListItem[]): TramiteListItem[] {
  // creados arriba primero
  return [...created.values(), ...base];
}

export function updateMockTramiteEstado(id: string, estado: TramiteEstado) {
  const t = created.get(id);
  if (!t) return;
  created.set(id, { ...t, estado_actual: estado });
}
