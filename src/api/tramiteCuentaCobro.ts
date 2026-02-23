import { api } from "./http";
import { withFallback } from "./fallback";
import { patchTramite } from "./tramiteUpdate";

export type CuentaCobroConcepto = {
  id: string;
  nombre: string;
  anio?: string;
  has4x1000: boolean;
  total: number;
  valor4x1000: number;
  observacion?: string;
};

export type CuentaCobroTotales = {
  totalAReembolsar: number;
  masTotalCuentaDeCobro: number;
  totalACancelar: number;
  menosAbono: number;
  saldoPdtePorCancelar: number;
};

export type CuentaCobroResumen = {
  conceptos: CuentaCobroConcepto[];
  honorarios: number;
  totales: CuentaCobroTotales;
};

export type SaveCuentaCobroPagosPayload = {
  conceptos: Array<{
    conceptoId: string;
    nombre?: string;
    anio?: string | number;
    total: number;
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

function parseBool(raw: unknown): boolean {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "number") return raw !== 0;
  if (typeof raw === "string") {
    const s = raw.trim().toLowerCase();
    return s === "true" || s === "1" || s === "si" || s === "sí" || s === "yes";
  }
  return false;
}

function asObject(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, any>;
}

function pick(obj: Record<string, any> | null, keys: string[]): unknown {
  if (!obj) return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      return obj[key];
    }
  }
  return undefined;
}

function normalizeConcepto(raw: unknown, index: number): CuentaCobroConcepto | null {
  const obj = asObject(raw);
  if (!obj) return null;

  const nombreRaw =
    pick(obj, ["nombre", "label", "concepto", "descripcion", "description"]) ?? `Concepto ${index + 1}`;
  const nombre = String(nombreRaw).trim() || `Concepto ${index + 1}`;

  const idRaw =
    pick(obj, ["id", "conceptoId", "concepto_id", "key", "codigo", "code"]) ??
    nombre.toLowerCase().replace(/\s+/g, "_");
  const id = String(idRaw);

  const valor4x1000 = parseMoney(
    pick(obj, [
      "valor4x1000",
      "valor_4x1000",
      "cuatroXMil",
      "cuatro_x_mil",
      "x4_1000",
      "valor4xmil",
      "4x1000",
    ])
  );

  const has4x1000Raw = pick(obj, [
    "has4x1000",
    "has_4x1000",
    "aplica4x1000",
    "aplica_4x1000",
    "muestra4x1000",
    "muestra_4x1000",
  ]);

  return {
    id,
    nombre,
    anio: String(pick(obj, ["anio", "ano", "year", "anos"]) ?? "").trim() || undefined,
    has4x1000: has4x1000Raw !== undefined ? parseBool(has4x1000Raw) : valor4x1000 > 0,
    total: parseMoney(pick(obj, ["total", "valor", "monto", "valorTotal", "valor_total"])),
    valor4x1000,
    observacion:
      String(pick(obj, ["observacion", "notes", "nota", "comentario"]) ?? "").trim() || undefined,
  };
}

function normalizeTotales(raw: unknown): CuentaCobroTotales {
  const obj = asObject(raw);

  const totalAReembolsar = parseMoney(
    pick(obj, ["totalAReembolsar", "total_a_reembolsar", "reembolsar", "totalReembolsar"])
  );
  const masTotalCuentaDeCobro = parseMoney(
    pick(obj, [
      "masTotalCuentaDeCobro",
      "mas_total_cuenta_de_cobro",
      "masTotalCuentaCobro",
      "honorarios",
      "honorariosValor",
      "honorarios_valor",
    ])
  );
  const totalACancelar = parseMoney(
    pick(obj, ["totalACancelar", "total_a_cancelar", "cancelar", "totalCancelar"])
  );
  const menosAbono = parseMoney(pick(obj, ["menosAbono", "menos_abono", "abono"]));
  const saldoPdtePorCancelar = parseMoney(
    pick(obj, [
      "saldoPdtePorCancelar",
      "saldo_pdte_por_cancelar",
      "saldoPendientePorCancelar",
      "saldo_pendiente_por_cancelar",
      "saldo",
    ])
  );

  return {
    totalAReembolsar,
    masTotalCuentaDeCobro,
    totalACancelar,
    menosAbono,
    saldoPdtePorCancelar,
  };
}

function buildResumenFromRoot(root: Record<string, any>): CuentaCobroResumen {
  const conceptosRaw =
    (Array.isArray(root.conceptos) && root.conceptos) ||
    (Array.isArray(root.pagos) && root.pagos) ||
    (Array.isArray(root.items) && root.items) ||
    [];

  const conceptos = conceptosRaw
    .map((x, i) => normalizeConcepto(x, i))
    .filter((x): x is CuentaCobroConcepto => !!x);

  const honorarios = parseMoney(
    pick(root, ["honorarios", "honorariosValor", "honorarios_valor", "valorHonorarios", "valor_honorarios"])
  );

  const totalesSource =
    asObject(pick(root, ["totales", "resumen", "summary"])) ??
    asObject(root);

  const totales = normalizeTotales(totalesSource);

  return { conceptos, honorarios, totales };
}

function normalizeCuentaCobroResumen(raw: unknown): CuentaCobroResumen {
  const top = asObject(raw);
  if (!top) {
    return {
      conceptos: [],
      honorarios: 0,
      totales: {
        totalAReembolsar: 0,
        masTotalCuentaDeCobro: 0,
        totalACancelar: 0,
        menosAbono: 0,
        saldoPdtePorCancelar: 0,
      },
    };
  }

  const nested = asObject(pick(top, ["data", "result", "payload"]));
  return buildResumenFromRoot(nested ?? top);
}

function isValidResumen(data: CuentaCobroResumen): boolean {
  return Array.isArray(data.conceptos) && !!data.totales;
}

type MockCuentaCobroState = {
  conceptos: CuentaCobroConcepto[];
  honorarios: number;
  abono: number;
};

const mockByTramite = new Map<string, MockCuentaCobroState>();

function cloneConcepts(list: CuentaCobroConcepto[]): CuentaCobroConcepto[] {
  return list.map((c) => ({ ...c }));
}

function ensureMockState(tramiteId: string): MockCuentaCobroState {
  const existing = mockByTramite.get(tramiteId);
  if (existing) return existing;

  const created: MockCuentaCobroState = {
    conceptos: [
      { id: "impuesto_timbre", nombre: "Impuesto de Timbre", has4x1000: true, total: 0, valor4x1000: 0 },
      { id: "impuesto_transito", nombre: "Impuesto de Transito", has4x1000: true, total: 0, valor4x1000: 0 },
      { id: "matricula", nombre: "Matricula", has4x1000: true, total: 0, valor4x1000: 0 },
      { id: "servicio", nombre: "Traspaso", has4x1000: true, total: 0, valor4x1000: 0 },
      { id: "envio_1", nombre: "Envio", has4x1000: true, total: 0, valor4x1000: 0 },
      { id: "envio_2", nombre: "Otro envio", has4x1000: false, total: 0, valor4x1000: 0 },
      { id: "pago_multas", nombre: "Pago de multas", has4x1000: false, total: 0, valor4x1000: 0 },
    ],
    honorarios: 0,
    abono: 0,
  };

  mockByTramite.set(tramiteId, created);
  return created;
}

function computeMockTotales(state: MockCuentaCobroState): CuentaCobroTotales {
  const totalAReembolsar = state.conceptos.reduce((acc, c) => acc + c.total + (c.has4x1000 ? c.valor4x1000 : 0), 0);
  const masTotalCuentaDeCobro = state.honorarios;
  const totalACancelar = totalAReembolsar + masTotalCuentaDeCobro;
  const menosAbono = state.abono;
  const saldoPdtePorCancelar = Math.max(0, totalACancelar - menosAbono);

  return {
    totalAReembolsar,
    masTotalCuentaDeCobro,
    totalACancelar,
    menosAbono,
    saldoPdtePorCancelar,
  };
}

function getMockResumen(tramiteId: string): CuentaCobroResumen {
  const state = ensureMockState(tramiteId);
  return {
    conceptos: cloneConcepts(state.conceptos),
    honorarios: state.honorarios,
    totales: computeMockTotales(state),
  };
}

function saveMockPagos(tramiteId: string, payload: SaveCuentaCobroPagosPayload): CuentaCobroResumen {
  const state = ensureMockState(tramiteId);
  const incoming = new Map(payload.conceptos.map((c) => [String(c.conceptoId), c]));

  state.conceptos = state.conceptos.map((c) => {
    const next = incoming.get(c.id);
    if (!next) return c;

    return {
      ...c,
      nombre: String(next.nombre ?? c.nombre).trim() || c.nombre,
      anio: String(next.anio ?? c.anio ?? "").trim() || undefined,
      total: Math.max(0, parseMoney(next.total)),
      valor4x1000: c.has4x1000 ? Math.max(0, parseMoney(next.valor4x1000 ?? 0)) : 0,
      observacion: String(next.observacion ?? c.observacion ?? "").trim() || undefined,
    };
  });

  mockByTramite.set(tramiteId, state);
  return getMockResumen(tramiteId);
}

function saveMockHonorarios(tramiteId: string, honorarios: number): CuentaCobroResumen {
  const state = ensureMockState(tramiteId);
  state.honorarios = Math.max(0, parseMoney(honorarios));
  mockByTramite.set(tramiteId, state);
  return getMockResumen(tramiteId);
}

async function getCuentaCobroApi(tramiteId: string): Promise<CuentaCobroResumen> {
  const urls = [
    `/tramites/${tramiteId}/cuenta-cobro`,
    `/tramites/${tramiteId}/cuenta-cobro/resumen`,
  ];

  let lastError: unknown;

  for (const url of urls) {
    try {
      const res = await api.get(url, {
        headers: { Accept: "application/json" },
        params: { _ts: Date.now() },
      });
      return normalizeCuentaCobroResumen(res.data);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ?? new Error("CUENTA_COBRO_NOT_AVAILABLE");
}

export async function getCuentaCobroResumen(tramiteId: string): Promise<CuentaCobroResumen> {
  return withFallback(
    () => getCuentaCobroApi(tramiteId),
    () => getMockResumen(tramiteId),
    isValidResumen
  );
}

export async function saveCuentaCobroPagos(
  tramiteId: string,
  payload: SaveCuentaCobroPagosPayload
): Promise<CuentaCobroResumen | { ok: true }> {
  return withFallback(
    async () => {
      const body = {
        conceptos: payload.conceptos.map((c) => ({
          conceptoId: c.conceptoId,
          nombre: typeof c.nombre === "string" ? c.nombre : undefined,
          anio: c.anio != null ? String(c.anio) : undefined,
          total: Math.max(0, parseMoney(c.total)),
          valor4x1000: Math.max(0, parseMoney(c.valor4x1000 ?? 0)),
          observacion: typeof c.observacion === "string" ? c.observacion : undefined,
        })),
      };

      const urls = [
        `/tramites/${tramiteId}/cuenta-cobro/pagos`,
        `/tramites/${tramiteId}/cuenta-cobro/conceptos`,
      ];

      let lastError: unknown;

      for (const url of urls) {
        try {
          const res = await api.post(url, body, { headers: { Accept: "application/json" } });
          if (res.data && typeof res.data === "object") {
            return normalizeCuentaCobroResumen(res.data);
          }
          return { ok: true as const };
        } catch (err) {
          lastError = err;
        }
      }

      throw lastError ?? new Error("NO_SAVE_PAGOS_ENDPOINT");
    },
    () => saveMockPagos(tramiteId, payload),
    (d) => !!d
  );
}

export async function saveCuentaCobroHonorarios(
  tramiteId: string,
  honorarios: number
): Promise<CuentaCobroResumen | { ok: true }> {
  const safe = Math.max(0, parseMoney(honorarios));

  return withFallback(
    async () => {
      const urls = [
        `/tramites/${tramiteId}/cuenta-cobro/honorarios`,
        `/tramites/${tramiteId}/honorarios`,
      ];

      let lastError: unknown;

      for (const url of urls) {
        try {
          const res = await api.post(
            url,
            { honorarios: safe, honorariosValor: safe },
            { headers: { Accept: "application/json" } }
          );
          if (res.data && typeof res.data === "object") {
            return normalizeCuentaCobroResumen(res.data);
          }
          return { ok: true as const };
        } catch (err: any) {
          lastError = err;
          const status = Number(err?.response?.status ?? 0);
          if (status && status !== 404 && status !== 405) {
            break;
          }
        }
      }

      // Compatibilidad con backend actual del proyecto.
      await patchTramite(tramiteId, { honorariosValor: safe });
      return { ok: true as const };
    },
    () => saveMockHonorarios(tramiteId, safe),
    (d) => !!d
  );
}
