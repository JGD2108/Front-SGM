import { api } from "./http";
import { withFallback } from "./fallback";
import { mockTramites, paginate } from "./mocks";
import type { PaginatedResponse, TramiteListItem } from "./types";
import type { TramiteEstado } from "./types";
import { listAllMockTramites } from "./mockTramitesState";

export type TramitesListParams = {
  page: number;
  pageSize: number;

  placa?: string;
  year?: number;
  concesionarioCode?: string;
  consecutivo?: number;
  clienteDoc?: string;
  ciudad?: string;
  estado?: TramiteEstado;
  createdFrom?: string; // YYYY-MM-DD
  createdTo?: string;   // YYYY-MM-DD
  includeCancelados?: boolean;
};

// cache mock en memoria
const ALL = mockTramites(180);

export async function listTramites(
  params: TramitesListParams
): Promise<PaginatedResponse<TramiteListItem>> {
  return withFallback(
    async () => {
      const res = await api.get("/tramites", {
        params,
        headers: { Accept: "application/json" },
      });

      const data = res.data as any;

      // soporta varias formas
      if (data?.items && typeof data.total === "number") {
        return data as PaginatedResponse<TramiteListItem>;
      }

      // ejemplo: { data: [...], meta: { total, page, pageSize } }
      if (Array.isArray(data?.data) && data?.meta?.total != null) {
        return {
          items: data.data,
          total: Number(data.meta.total),
          page: Number(data.meta.page ?? params.page),
          pageSize: Number(data.meta.pageSize ?? params.pageSize),
        };
      }

      // si no tiene forma esperada, forzamos fallback
      throw new Error("INVALID_TRAMITES_SHAPE");
    },
    async () => {
      let items = [...listAllMockTramites(ALL)];

      if (!params.includeCancelados) {
        items = items.filter((t) => t.estado_actual !== "CANCELADO");
      }
      if (params.placa) {
        const q = params.placa.toLowerCase();
        items = items.filter((t) => (t.placa ?? "").toLowerCase().includes(q));
      }
      if (params.year) items = items.filter((t) => t.year === params.year);
      if (params.concesionarioCode) items = items.filter((t) => t.concesionario_code === params.concesionarioCode);
      if (params.consecutivo) items = items.filter((t) => t.consecutivo === params.consecutivo);
      if (params.clienteDoc) items = items.filter((t) => (t.cliente_doc ?? "").includes(params.clienteDoc));
      if (params.ciudad) items = items.filter((t) => (t.ciudad_nombre ?? "") === params.ciudad);
      if (params.estado) items = items.filter((t) => t.estado_actual === params.estado);

      return paginate(items, params.page, params.pageSize);
    },
    (data) => !!data && Array.isArray((data as any).items) && typeof (data as any).total === "number"
  );
}
