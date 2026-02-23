// src/api/servicios.ts
import { api } from "./http";
import type { ServicioTipo } from "./servicioTemplates";

export type ServicioEstado =
  | "RECIBIDO"
  | "EN_REVISION"
  | "PENDIENTE_DOCUMENTOS"
  | "PENDIENTE_PAGOS"
  | "RADICADO"
  | "EN_TRAMITE"
  | "LISTO_PARA_ENTREGA"
  | "ENTREGADO"
  | "CANCELADO"
  | string;

function isHtmlResponse(data: unknown): boolean {
  return typeof data === "string" && data.toLowerCase().includes("<!doctype html");
}

function isRouteMissing(status: number): boolean {
  return status === 404 || status === 405 || status === 501;
}

// =========
// LISTADO
// =========
export type ServicioListItem = {
  id: string;
  display_id: string;
  year: number;
  concesionario_code: string;
  consecutivo: number;
  tipo_servicio: ServicioTipo;
  estado_servicio: ServicioEstado;
  ciudad_nombre: string;
  cliente_nombre: string;
  cliente_doc: string;
  gestor_nombre: string | null;
  gestor_telefono: string | null;
  created_at: string;
};

export type ServiciosListFilters = {
  page?: number;
  pageSize?: number;
  includeCancelados?: boolean;
  tipoServicio?: ServicioTipo;
  estadoServicio?: ServicioEstado;
  concesionarioCode?: string;
  year?: number;
  consecutivo?: number;
  ciudad?: string;
  clienteDoc?: string;
};

export type ServiciosListResponse = {
  total: number;
  items: ServicioListItem[];
};

function normalizeListResponse(data: any): ServiciosListResponse {
  if (!data) return { total: 0, items: [] };
  if (Array.isArray(data)) return { total: data.length, items: data as any };
  return {
    total: Number(data.total ?? 0),
    items: Array.isArray(data.items) ? (data.items as any) : [],
  };
}

/**
 * ✅ GET /servicios
 */
export async function listServicios(filters: ServiciosListFilters): Promise<ServiciosListResponse> {
  const params = {
    page: filters.page ?? 1,
    pageSize: filters.pageSize ?? 20,
    includeCancelados: filters.includeCancelados ?? false,

    tipoServicio: filters.tipoServicio,
    estadoServicio: filters.estadoServicio,
    concesionarioCode: filters.concesionarioCode,
    year: filters.year,
    consecutivo: filters.consecutivo,
    ciudad: filters.ciudad,
    clienteDoc: filters.clienteDoc,
  };

  const res = await api.get(`/servicios`, { params, headers: { Accept: "application/json" } });
  return normalizeListResponse(res.data);
}

// =========
// CREAR
// =========
export type CreateServicioInput = {
  tipoServicio: ServicioTipo;
  concesionarioCode: string;
  ciudad: string;
  clienteNombre: string;
  clienteDoc: string;
  gestorNombre?: string;
  gestorTelefono?: string;
  serviceData?: Record<string, any>;
};

export type CreateServicioResponse = {
  id: string;
  display_id: string;
  year: number;
  concesionario_code: string;
  consecutivo: number;
  tipo_servicio: ServicioTipo;
  estado_servicio: ServicioEstado;
};

/**
 * ✅ POST /servicios
 */
export async function createServicio(payload: CreateServicioInput): Promise<CreateServicioResponse> {
  const res = await api.post(`/servicios`, payload, { headers: { Accept: "application/json" } });
  return res.data;
}

// =========
// DETALLE
// =========
export type ServicioPago = {
  id: string;
  concepto: string;
  valor: number;
  anio?: string | null;
  valor_total?: number | null;
  valor_4x1000?: number | null;
  observacion?: string | null;
  created_at: string;
};

export type ServicioDetail = {
  id: string;
  display_id: string;
  year: number;
  concesionario_code: string;
  consecutivo: number;
  tipo_servicio: ServicioTipo;
  estado_servicio: ServicioEstado;
  ciudad_nombre: string;
  cliente_nombre: string;
  cliente_doc: string;
  gestor_nombre: string | null;
  gestor_telefono: string | null;
  service_data: Record<string, any> | null;
  created_at?: string;
  placa?: string | null;
  honorariosValor?: number | string | null;
  honorarios_valor?: number | string | null;

  pagos: ServicioPago[];
  total_pagos_servicio: number;
};

/**
 * ✅ GET /servicios/:id
 */
export async function getServicioById(id: string): Promise<ServicioDetail> {
  const res = await api.get(`/servicios/${id}`, { headers: { Accept: "application/json" } });
  return res.data;
}

// =========
// PATCH (guardar form + gestor)
// =========
export type PatchServicioInput = {
  serviceData?: Record<string, any> | null;
  gestorNombre?: string;
  gestorTelefono?: string;
  honorariosValor?: number | string | null;
};

/**
 * ✅ PATCH /servicios/:id
 */
export async function patchServicio(id: string, payload: PatchServicioInput): Promise<ServicioDetail> {
  const res = await api.patch(`/servicios/${id}`, payload, { headers: { Accept: "application/json" } });
  return res.data;
}

export type DeleteServicioResult = {
  ok: true;
  mode: "deleted" | "cancelled";
};

/**
 * ✅ DELETE /servicios/:id
 * Fallbacks:
 * - POST /servicios/:id/cancelar
 * - POST /servicios/:id/estado { toEstado: "CANCELADO" }
 */
export async function deleteServicio(
  id: string,
  payload?: { reason?: string }
): Promise<DeleteServicioResult> {
  try {
    const res = await api.delete(`/servicios/${id}`, { headers: { Accept: "application/json" } });
    if (isHtmlResponse(res.data)) throw new Error("HTML_RESPONSE");
    return { ok: true, mode: "deleted" };
  } catch (e: any) {
    const status = Number(e?.response?.status ?? 0);
    if (!isRouteMissing(status)) throw e;
  }

  try {
    const res = await api.post(
      `/servicios/${id}/cancelar`,
      { reason: payload?.reason },
      { headers: { Accept: "application/json" } }
    );
    if (isHtmlResponse(res.data)) throw new Error("HTML_RESPONSE");
    return { ok: true, mode: "cancelled" };
  } catch (e: any) {
    const status = Number(e?.response?.status ?? 0);
    if (!isRouteMissing(status)) throw e;
  }

  const res = await api.post(
    `/servicios/${id}/estado`,
    { toEstado: "CANCELADO", notes: payload?.reason },
    { headers: { Accept: "application/json" } }
  );
  if (isHtmlResponse(res.data)) throw new Error("HTML_RESPONSE");
  return { ok: true, mode: "cancelled" };
}

// =========
// ESTADOS
// =========
export type EstadoHistItem = {
  from_estado_servicio: ServicioEstado | null;
  to_estado_servicio: ServicioEstado;
  changed_at: string;
  changed_by: string;
  notes?: string | null;
  action_type: "NORMAL" | "REABRIR" | "CANCELAR" | "FINALIZAR" | string;
};

// ✅ Alias EXACTO para que tu ServicioDetailPage compile sin tocar imports
export type ServicioEstadoHistItem = EstadoHistItem;

/**
 * ✅ POST /servicios/:id/estado
 */
export async function changeServicioEstado(
  id: string,
  payload: { toEstado: ServicioEstado; notes?: string }
): Promise<{ ok: true }> {
  const res = await api.post(`/servicios/${id}/estado`, payload, { headers: { Accept: "application/json" } });
  if (res.data?.ok === true) return { ok: true };
  return { ok: true };
}

/**
 * ✅ GET /servicios/:id/estados/historial
 */
export async function getServicioEstadoHist(id: string): Promise<EstadoHistItem[]> {
  const res = await api.get(`/servicios/${id}/estados/historial`, { headers: { Accept: "application/json" } });
  return Array.isArray(res.data) ? res.data : Array.isArray(res.data?.items) ? res.data.items : [];
}

// =========
// PAGOS
// =========
export type ServicioPagosResponse = {
  total: number;
  items: ServicioPago[];
};

function parsePagoNumber(raw: unknown): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function normalizeServicioPago(raw: any): ServicioPago {
  const valorTotal = raw?.valor_total ?? raw?.valorTotal ?? raw?.valor ?? 0;
  const valor4x1000 = raw?.valor_4x1000 ?? raw?.valor4x1000 ?? raw?.cuatro_x_mil ?? raw?.cuatroXMil ?? 0;

  return {
    id: String(raw?.id ?? `${Date.now()}-${Math.random()}`),
    concepto: String(raw?.concepto ?? raw?.nombre ?? raw?.descripcion ?? ""),
    valor: parsePagoNumber(raw?.valor ?? valorTotal),
    anio: raw?.anio != null ? String(raw.anio) : raw?.ano != null ? String(raw.ano) : null,
    valor_total: parsePagoNumber(valorTotal),
    valor_4x1000: parsePagoNumber(valor4x1000),
    observacion: raw?.observacion ?? raw?.notes ?? raw?.nota ?? null,
    created_at: String(raw?.created_at ?? raw?.fecha ?? new Date().toISOString()),
  };
}

/**
 * ✅ GET /servicios/:id/pagos
 */
export async function listServicioPagos(id: string): Promise<ServicioPagosResponse> {
  const res = await api.get(`/servicios/${id}/pagos`, { headers: { Accept: "application/json" } });
  const data = res.data;

  if (Array.isArray(data)) {
    return { total: data.length, items: data.map((x: any) => normalizeServicioPago(x)) };
  }
  return {
    total: Number(data?.total ?? 0),
    items: Array.isArray(data?.items) ? data.items.map((x: any) => normalizeServicioPago(x)) : [],
  };
}

/**
 * ✅ Alias EXACTO para que tu import `getServicioPagos` compile
 */
export async function getServicioPagos(id: string): Promise<ServicioPagosResponse> {
  return listServicioPagos(id);
}

/**
 * ✅ POST /servicios/:id/pagos
 */
export async function createServicioPago(
  id: string,
  payload: {
    concepto: string;
    valor?: number;
    anio?: string | number | null;
    valorTotal?: number;
    valor_total?: number;
    valor4x1000?: number;
    valor_4x1000?: number;
    observacion?: string;
  }
): Promise<{ ok: true } | ServicioPago> {
  const total = parsePagoNumber(payload.valor_total ?? payload.valorTotal ?? payload.valor ?? 0);
  const cuatro = parsePagoNumber(payload.valor_4x1000 ?? payload.valor4x1000 ?? 0);

  const body = {
    concepto: String(payload.concepto ?? "").trim(),
    anio: payload.anio != null && String(payload.anio).trim() !== "" ? String(payload.anio).trim() : undefined,
    valor: total,
    valor_total: total,
    valor_4x1000: cuatro,
    observacion: payload.observacion?.trim() || undefined,
  };

  const res = await api.post(`/servicios/${id}/pagos`, body, { headers: { Accept: "application/json" } });
  if (!res.data || res.data.ok === true) return { ok: true };
  return normalizeServicioPago(res.data);
}

/**
 * ✅ Alias EXACTO para que tu import `addServicioPago` compile
 */
export async function addServicioPago(
  id: string,
  payload: {
    concepto: string;
    valor?: number;
    anio?: string | number | null;
    valorTotal?: number;
    valor_total?: number;
    valor4x1000?: number;
    valor_4x1000?: number;
    observacion?: string;
  }
): Promise<{ ok: true } | ServicioPago> {
  return createServicioPago(id, payload);
}
