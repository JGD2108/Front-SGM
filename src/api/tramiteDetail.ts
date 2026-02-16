import { api } from "./http";
import { withFallback } from "./fallback";
import type { TramiteListItem } from "./types";
import { mockTramites } from "./mocks";
import { ensureMockHist, getMockEstado } from "./mockState";
import { getMockTramite } from "./mockTramitesState";

export type TramiteDetail = TramiteListItem & {
  notes?: string | null;
};

const ALL = mockTramites(180);

function mockGetById(id: string): TramiteDetail {
  const created = getMockTramite(id);
if (created) {
  ensureMockHist(created.id, created.estado_actual, created.created_at);
  const estado = getMockEstado(created.id, created.estado_actual);
  return { ...created, estado_actual: estado, notes: null };
}

  const found = ALL.find((t) => t.id === id);

  if (found) {
    // asegura historial y estado “source of truth” en mock
    ensureMockHist(found.id, found.estado_actual, found.created_at);
    const estado = getMockEstado(found.id, found.estado_actual);

    return { ...found, estado_actual: estado, notes: null };
  }

  const fallback = ALL[0];
  ensureMockHist(id, fallback.estado_actual, fallback.created_at);
  const estado = getMockEstado(id, fallback.estado_actual);

  return { ...fallback, id, estado_actual: estado, display_id: `2026-${fallback.concesionario_code}-9999`, notes: null };
}

function looksValidDetail(data: any): data is TramiteDetail {
  return data && typeof data.id === "string" && typeof data.display_id === "string";
}

export async function getTramiteById(id: string): Promise<TramiteDetail> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/${id}`, { headers: { Accept: "application/json" } });
      const data = res.data;
      if (!looksValidDetail(data)) throw new Error("INVALID_TRAMITE_DETAIL");
      return data;
    },
    () => mockGetById(id),
    looksValidDetail
  );
}
