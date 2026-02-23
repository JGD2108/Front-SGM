import { api } from "./http";
import { withFallback } from "./fallback";
import { getServicioById, listServicioPagos, patchServicio, type ServicioPago } from "./servicios";

export type ServicioCuentaCobroBaseData = {
  servicio: string;
  fecha: string;
  cliente: string;
  clienteDoc: string;
  placas: string;
  ciudad: string;
  concesionario: string;
};

export type ServicioCuentaCobroPago = {
  id: string;
  concepto: string;
  anio?: string;
  valorTotal: number;
  valor4x1000: number;
  observacion?: string;
};

export type ServicioCuentaCobroTotales = {
  totalAReembolsar: number;
  masTotalCuentaDeCobro: number;
  totalACancelar: number;
  menosAbono: number;
  saldoPdtePorCancelar: number;
};

export type ServicioCuentaCobroResumen = {
  baseData: ServicioCuentaCobroBaseData;
  honorarios: number;
  pagos: ServicioCuentaCobroPago[];
  totales: ServicioCuentaCobroTotales;
};

export type SaveServicioCuentaCobroPagosPayload = {
  pagos: Array<{
    conceptoId: string;
    concepto: string;
    anio?: string | number;
    valorTotal: number;
    valor4x1000?: number;
    observacion?: string;
  }>;
};

function parseMoney(raw: unknown): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : 0;
  if (typeof raw === "string") {
    const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asObject(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, any>;
}

function pick(obj: Record<string, any> | null, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) return obj[key];
  }
  return undefined;
}

function normalizePago(raw: unknown, index: number): ServicioCuentaCobroPago | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const valorTotal = parseMoney(pick(obj, ["valor_total", "valorTotal", "total", "valor"]));
  const valor4x1000 = parseMoney(
    pick(obj, ["valor_4x1000", "valor4x1000", "cuatro_x_mil", "cuatroXMil", "4x1000"])
  );

  return {
    id: String(pick(obj, ["id"]) ?? `pago_${index + 1}`),
    concepto: String(pick(obj, ["concepto", "nombre", "descripcion"]) ?? "").trim(),
    anio: String(pick(obj, ["anio", "ano", "year"]) ?? "").trim() || undefined,
    valorTotal,
    valor4x1000,
    observacion: String(pick(obj, ["observacion", "notes", "nota"]) ?? "").trim() || undefined,
  };
}

function cloneServiceData(servicio: any): Record<string, any> {
  const sd = servicio?.service_data;
  if (!sd || typeof sd !== "object" || Array.isArray(sd)) return {};
  return { ...(sd as Record<string, any>) };
}

async function patchServicioCuentaCobroServiceData(
  servicioId: string,
  patch: { pagos?: SaveServicioCuentaCobroPagosPayload["pagos"]; honorarios?: number }
) {
  const servicio = await getServicioById(servicioId);
  const serviceData = cloneServiceData(servicio);
  const currentCuentaCobro =
    serviceData.cuentaCobro && typeof serviceData.cuentaCobro === "object" && !Array.isArray(serviceData.cuentaCobro)
      ? { ...(serviceData.cuentaCobro as Record<string, any>) }
      : {};

  if (patch.honorarios !== undefined) {
    currentCuentaCobro.honorarios = Math.max(0, parseMoney(patch.honorarios));
  }

  if (patch.pagos) {
    currentCuentaCobro.pagos = patch.pagos.map((p) => ({
      conceptoId: String(p.conceptoId),
      concepto: String(p.concepto ?? "").trim(),
      anio: p.anio != null ? String(p.anio).trim() : "",
      valor_total: Math.max(0, parseMoney(p.valorTotal)),
      valor_4x1000: Math.max(0, parseMoney(p.valor4x1000 ?? 0)),
      observacion: String(p.observacion ?? "").trim(),
    }));
  }

  serviceData.cuentaCobro = currentCuentaCobro;
  return patchServicio(servicioId, { serviceData });
}

function normalizeBaseData(raw: unknown): ServicioCuentaCobroBaseData {
  const obj = asObject(raw);
  return {
    servicio: String(pick(obj, ["servicio", "servicioNombre", "service_name", "serviceName"]) ?? "").trim() || "-",
    fecha: String(pick(obj, ["fecha", "date", "created_at", "createdAt"]) ?? "").slice(0, 10) || "-",
    cliente: String(pick(obj, ["cliente", "cliente_nombre", "clienteNombre"]) ?? "").trim() || "-",
    clienteDoc: String(pick(obj, ["clienteDoc", "cliente_doc", "nit", "cc", "documento"]) ?? "").trim() || "-",
    placas: String(pick(obj, ["placas", "placa", "plate"]) ?? "").trim() || "-",
    ciudad: String(pick(obj, ["ciudad", "ciudad_nombre", "ciudadNombre"]) ?? "").trim() || "-",
    concesionario: String(pick(obj, ["concesionario", "concesionario_code", "concesionarioCode"]) ?? "").trim() || "-",
  };
}

function normalizeTotales(raw: unknown): ServicioCuentaCobroTotales {
  const obj = asObject(raw);
  return {
    totalAReembolsar: parseMoney(pick(obj, ["totalAReembolsar", "total_a_reembolsar"])),
    masTotalCuentaDeCobro: parseMoney(
      pick(obj, ["masTotalCuentaDeCobro", "mas_total_cuenta_de_cobro", "honorarios", "honorariosValor", "honorarios_valor"])
    ),
    totalACancelar: parseMoney(pick(obj, ["totalACancelar", "total_a_cancelar"])),
    menosAbono: parseMoney(pick(obj, ["menosAbono", "menos_abono", "abono"])),
    saldoPdtePorCancelar: parseMoney(
      pick(obj, ["saldoPdtePorCancelar", "saldo_pdte_por_cancelar", "saldoPendientePorCancelar"])
    ),
  };
}

function normalizeResumen(raw: unknown): ServicioCuentaCobroResumen {
  const top = asObject(raw) ?? {};
  const root = asObject(pick(top, ["data", "result", "payload"])) ?? top;

  const pagosRaw =
    (Array.isArray(root.pagos) && root.pagos) ||
    (Array.isArray(root.conceptos) && root.conceptos) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  const pagos = pagosRaw.map((x, i) => normalizePago(x, i)).filter((x): x is ServicioCuentaCobroPago => !!x);
  const baseData = normalizeBaseData(asObject(pick(root, ["baseData", "datosBase", "cabecera"])) ?? root);
  const honorarios = parseMoney(
    pick(root, ["honorarios", "honorariosValor", "honorarios_valor", "valorHonorarios", "valor_honorarios"])
  );
  const totalesSrc = asObject(pick(root, ["totales", "resumen", "summary"])) ?? root;
  const totales = normalizeTotales(totalesSrc);

  return { baseData, honorarios, pagos, totales };
}

function isValidResumen(data: ServicioCuentaCobroResumen): boolean {
  return !!data && !!data.baseData && Array.isArray(data.pagos) && !!data.totales;
}

function pagoFromServicioPago(p: ServicioPago): ServicioCuentaCobroPago {
  return {
    id: p.id,
    concepto: p.concepto ?? "",
    anio: p.anio ?? undefined,
    valorTotal: parseMoney(p.valor_total ?? p.valor ?? 0),
    valor4x1000: parseMoney(p.valor_4x1000 ?? 0),
    observacion: p.observacion ?? undefined,
  };
}

function buildTotalsFromFallback(pagos: ServicioCuentaCobroPago[], honorarios: number): ServicioCuentaCobroTotales {
  const totalAReembolsar = pagos.reduce((acc, p) => acc + parseMoney(p.valorTotal) + parseMoney(p.valor4x1000), 0);
  const masTotalCuentaDeCobro = parseMoney(honorarios);
  const totalACancelar = totalAReembolsar + masTotalCuentaDeCobro;
  const menosAbono = 0;
  const saldoPdtePorCancelar = totalACancelar - menosAbono;
  return { totalAReembolsar, masTotalCuentaDeCobro, totalACancelar, menosAbono, saldoPdtePorCancelar };
}

function getFallbackHonorarios(servicio: any): number {
  const fromRoot = parseMoney(servicio?.honorariosValor ?? servicio?.honorarios_valor);
  if (fromRoot) return fromRoot;
  return parseMoney(servicio?.service_data?.cuentaCobro?.honorarios ?? servicio?.service_data?.honorariosValor);
}

async function getServicioCuentaCobroApi(servicioId: string): Promise<ServicioCuentaCobroResumen> {
  const urls = [`/servicios/${servicioId}/cuenta-cobro`, `/servicios/${servicioId}/cuenta-cobro/resumen`];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const res = await api.get(url, {
        headers: { Accept: "application/json" },
        params: { _ts: Date.now() },
      });
      return normalizeResumen(res.data);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("SERVICIO_CUENTA_COBRO_NOT_AVAILABLE");
}

export async function getServicioCuentaCobroResumen(servicioId: string): Promise<ServicioCuentaCobroResumen> {
  return withFallback(
    () => getServicioCuentaCobroApi(servicioId),
    async () => {
      const [servicio, pagosResp] = await Promise.all([getServicioById(servicioId), listServicioPagos(servicioId)]);
      const storedRaw = (servicio as any)?.service_data?.cuentaCobro?.pagos;
      const storedPagos = Array.isArray(storedRaw)
        ? storedRaw.map((x: any, i: number) => normalizePago(x, i)).filter((x): x is ServicioCuentaCobroPago => !!x)
        : [];
      const pagos = storedPagos.length ? storedPagos : (pagosResp.items ?? []).map(pagoFromServicioPago);
      const honorarios = getFallbackHonorarios(servicio);
      const baseData: ServicioCuentaCobroBaseData = {
        servicio: String((servicio as any)?.servicio_nombre ?? servicio?.tipo_servicio ?? "-"),
        fecha: String((servicio as any)?.fecha ?? servicio?.created_at ?? "").slice(0, 10) || "-",
        cliente: String(servicio?.cliente_nombre ?? "-"),
        clienteDoc: String(servicio?.cliente_doc ?? "-"),
        placas: String((servicio as any)?.placa ?? "-"),
        ciudad: String(servicio?.ciudad_nombre ?? "-"),
        concesionario: String(servicio?.concesionario_code ?? "-"),
      };
      return {
        baseData,
        honorarios,
        pagos,
        totales: buildTotalsFromFallback(pagos, honorarios),
      };
    },
    isValidResumen
  );
}

export async function saveServicioCuentaCobroPagos(
  servicioId: string,
  payload: SaveServicioCuentaCobroPagosPayload
): Promise<{ ok: true } | ServicioCuentaCobroResumen> {
  return withFallback(
    async () => {
      const body = {
        pagos: payload.pagos.map((p) => ({
          conceptoId: String(p.conceptoId),
          concepto: String(p.concepto ?? "").trim(),
          anio: p.anio != null ? String(p.anio).trim() : undefined,
          valor_total: Math.max(0, parseMoney(p.valorTotal)),
          valor_4x1000: Math.max(0, parseMoney(p.valor4x1000 ?? 0)),
          observacion: String(p.observacion ?? "").trim() || undefined,
        })),
      };

      const urls = [`/servicios/${servicioId}/cuenta-cobro/pagos`, `/servicios/${servicioId}/cuenta-cobro/conceptos`];
      let lastError: unknown;

      for (const url of urls) {
        try {
          const res = await api.post(url, body, { headers: { Accept: "application/json" } });
          if (res.data && typeof res.data === "object") return normalizeResumen(res.data);
          return { ok: true as const };
        } catch (err: any) {
          lastError = err;
          const status = Number(err?.response?.status ?? 0);
          if (status && status !== 404 && status !== 405) break;
        }
      }

      throw lastError ?? new Error("NO_SERVICIO_CUENTA_COBRO_PAGOS_ENDPOINT");
    },
    async () => {
      await patchServicioCuentaCobroServiceData(servicioId, { pagos: payload.pagos });
      return { ok: true as const };
    },
    (d) => !!d
  );
}

export async function saveServicioCuentaCobroHonorarios(
  servicioId: string,
  honorarios: number
): Promise<{ ok: true } | ServicioCuentaCobroResumen> {
  const safe = Math.max(0, parseMoney(honorarios));

  return withFallback(
    async () => {
      const urls = [`/servicios/${servicioId}/cuenta-cobro/honorarios`, `/servicios/${servicioId}/honorarios`];
      let lastError: unknown;

      for (const url of urls) {
        try {
          const res = await api.post(
            url,
            { honorarios: safe, honorariosValor: safe },
            { headers: { Accept: "application/json" } }
          );
          if (res.data && typeof res.data === "object") return normalizeResumen(res.data);
          return { ok: true as const };
        } catch (err: any) {
          lastError = err;
          const status = Number(err?.response?.status ?? 0);
          if (status && status !== 404 && status !== 405) break;
        }
      }

      try {
        await patchServicio(servicioId, { honorariosValor: safe });
      } catch {
        await patchServicioCuentaCobroServiceData(servicioId, { honorarios: safe });
      }
      return { ok: true as const };
    },
    async () => {
      await patchServicioCuentaCobroServiceData(servicioId, { honorarios: safe });
      return { ok: true as const };
    },
    (d) => !!d
  );
}

export async function downloadServicioCuentaCobroPdf(servicioId: string): Promise<Blob> {
  const urls = [`/servicios/${servicioId}/cuenta-cobro.pdf`, `/servicios/${servicioId}/cuenta-cobro/pdf`];
  let lastError: unknown;

  for (const url of urls) {
    try {
      const res = await api.get(url, { responseType: "blob" });
      return res.data as Blob;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("SERVICIO_CUENTA_COBRO_PDF_NOT_AVAILABLE");
}

