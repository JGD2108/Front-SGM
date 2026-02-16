import { api } from "./http";
import { withFallback } from "./fallback";
import { mockTramites } from "./mocks";
import type { TramiteListItem } from "./types";

export type AtrasadoItem = {
  tramite: TramiteListItem;
  rule: string;      // texto simple (luego backend manda la regla real)
  daysLate: number;  // número
};

function isHtml(data: any) {
  return typeof data === "string" && data.toLowerCase().includes("<!doctype html");
}

function looksLikeAtrasados(x: any): x is AtrasadoItem[] {
  return Array.isArray(x) && x.every((i) => i?.tramite?.id && typeof i?.daysLate === "number");
}

function mockAtrasados(): AtrasadoItem[] {
  // usamos tu mock de tramites y marcamos atrasados los que ya vienen con is_atrasado=true
  const all = mockTramites(220);
  const atras = all.filter((t) => t.is_atrasado);

  // si no hay ninguno marcado, fuerza algunos por demo
  const take = (atras.length ? atras : all.slice(0, 10)).slice(0, 25);

  return take.map((t, idx) => ({
    tramite: t,
    rule: "Regla mock: tiempo máximo excedido",
    daysLate: 3 + (idx % 15),
  }));
}

export async function getAtrasados(): Promise<AtrasadoItem[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/tramites/atrasados`, { headers: { Accept: "application/json" } });
      const data = res.data;
      if (isHtml(data)) throw new Error("HTML_RESPONSE");
      if (!looksLikeAtrasados(data)) throw new Error("INVALID_ATRASADOS");
      return data;
    },
    () => mockAtrasados(),
    looksLikeAtrasados
  );
}
