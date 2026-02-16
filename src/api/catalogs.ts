import { api } from "./http";

export type ConcesionarioItem = { code: string; name?: string };
export type CiudadItem = { name: string };

export async function getConcesionarios(): Promise<ConcesionarioItem[]> {
  const res = await api.get("/catalogs/concesionarios", { headers: { Accept: "application/json" } });
  const data = res.data;
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!items) throw new Error("INVALID_CONCESIONARIOS");
  return items;
}

export async function getCiudades(): Promise<CiudadItem[]> {
  const res = await api.get("/catalogs/ciudades", { headers: { Accept: "application/json" } });
  const data = res.data;
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!items) throw new Error("INVALID_CIUDADES");
  return items;
}
