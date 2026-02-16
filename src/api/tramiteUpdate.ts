// src/api/tramiteUpdate.ts
import { api } from "./http";

export type PatchTramiteInput = {
  honorariosValor?: number | string | null;
};

export async function patchTramite(tramiteId: string, dto: PatchTramiteInput) {
  const res = await api.patch(`/tramites/${tramiteId}`, dto, {
    headers: { Accept: "application/json" },
  });
  return res.data;
}
