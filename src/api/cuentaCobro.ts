// src/api/cuentaCobro.ts
import { api } from "./http";

export async function downloadCuentaCobroPdf(tramiteId: string) {
  const res = await api.get(`/tramites/${tramiteId}/cuenta-cobro.pdf`, {
    responseType: "blob",
  });
  return res.data as Blob;
}
