import type { Concesionario, Ciudad } from "./catalogs";
import type { PaginatedResponse, TramiteEstado, TramiteListItem } from "./types";

export const MOCK_CONCESIONARIOS: Concesionario[] = [
  { code: "AUTOTROPICAL", name: "Autotropical - Toyota" },
  { code: "MOTOCOSTA", name: "Motocosta - Renault" },
  { code: "JUANAUTOS", name: "Juanautos - Renault" },
  { code: "ALEMANA", name: "Alemana Automotriz - Mercedes Benz" },
  { code: "MASSY", name: "Massy Motors - Multimarcas" },
  { code: "DAVIVIENDA", name: "Davivienda - Multimarcas" }
];

export const MOCK_CIUDADES: Ciudad[] = [
  { name: "Barranquilla" },
  { name: "Cartagena" },
  { name: "Santa Marta" },
  { name: "Soledad" },
  { name: "Medellín" },
  { name: "Cali" }
];

const ESTADOS: TramiteEstado[] = [
  "FACTURA_RECIBIDA",
  "PLACA_ASIGNADA",
  "DOCS_FISICOS_PENDIENTES",
  "DOCS_FISICOS_COMPLETOS",
  "TIMBRE_PAGADO",
  "DERECHOS_PAGADOS",
  "FINALIZADO_ENTREGADO",
  "CANCELADO"
];

function rand<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

function randomPlaca() {
  const letters = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
  return `${letters()}${letters()}${letters()}${Math.floor(100 + Math.random() * 900)}`;
}

export function mockTramites(total = 137): TramiteListItem[] {
  const year = 2026;
  const baseDate = Date.now() - 1000 * 60 * 60 * 24 * 60;

  return Array.from({ length: total }).map((_, i) => {
    const cons = rand(MOCK_CONCESIONARIOS);
    const estado = rand(ESTADOS);
    const consecutivo = i + 1;

    return {
      id: `T-${i + 1}`,
      year,
      concesionario_code: cons.code,
      consecutivo,
      display_id: `${year}-${cons.code}-${pad4(consecutivo)}`,
      estado_actual: estado,
      placa: Math.random() > 0.25 ? randomPlaca() : null,
      ciudad_nombre: rand(MOCK_CIUDADES).name,
      cliente_doc: String(10000000 + Math.floor(Math.random() * 90000000)),
      cliente_nombre: `Cliente ${i + 1}`,
      created_at: new Date(baseDate + i * 1000 * 60 * 60 * 6).toISOString(),
      is_atrasado: Math.random() < 0.12
    };
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResponse<T> {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total: items.length
  };
}
