// src/api/createTramite.ts
import { api } from "./http";
import { withFallback } from "./fallback";
import type { TramiteListItem } from "./types";
import { addMockTramite } from "./mockTramitesState";
import { ensureMockDocs, mockUploadFile } from "./mockDocsState";

// payload mínimo del front
export type CreateTramiteInput = {
  concesionarioCode: string;
  ciudad: string;
  clienteNombre: string;
  clienteDoc: string;
  placa?: string;
  facturaFile: File; // obligatorio
};

export type CreateTramiteResponse = {
  id: string;
  display_id: string;
  year: number;
  concesionario_code: string;
  consecutivo: number;
};

function pad4(n: number) {
  return String(n).padStart(4, "0");
}

// contador simple mock (en memoria)
let mockConsecutivo = 1;

function mockCreate(input: CreateTramiteInput): CreateTramiteResponse {
  const year = 2026;
  const consecutivo = mockConsecutivo++;
  const id = `T-${Date.now()}`;
  const display_id = `${year}-${input.concesionarioCode}-${pad4(consecutivo)}`;
  const created_at = new Date().toISOString();

  // guarda el trámite para bandeja/detalle
  const item: TramiteListItem = {
    id,
    year,
    concesionario_code: input.concesionarioCode,
    consecutivo,
    display_id,
    estado_actual: "FACTURA_RECIBIDA",
    placa: input.placa ?? null,
    ciudad_nombre: input.ciudad,
    cliente_doc: input.clienteDoc,
    cliente_nombre: input.clienteNombre,
    created_at,
    is_atrasado: false,
  };

  addMockTramite(item);

  // ✅ Inicializa checklist y sube factura v1
  ensureMockDocs(id);
  mockUploadFile(id, {
    docKey: "FACTURA",
    file: input.facturaFile,
    uploadedBy: "usuario",
  });

  return {
    id,
    year,
    consecutivo,
    concesionario_code: input.concesionarioCode,
    display_id,
  };
}


function looksValidCreateResponse(data: any): data is CreateTramiteResponse {
  return (
    data &&
    typeof data.id === "string" &&
    typeof data.display_id === "string" &&
    typeof data.year === "number" &&
    typeof data.concesionario_code === "string" &&
    typeof data.consecutivo === "number"
  );
}

export async function createTramite(
  input: CreateTramiteInput
): Promise<CreateTramiteResponse> {
  return withFallback(
    async () => {
      // ✅ REAL (backend): multipart/form-data
      const form = new FormData();
      form.append("concesionarioCode", input.concesionarioCode);
      form.append("ciudad", input.ciudad);
      form.append("clienteNombre", input.clienteNombre);
      form.append("clienteDoc", input.clienteDoc);
      if (input.placa) form.append("placa", input.placa);

      // Nombre de campo recomendado: "factura"
      form.append("factura", input.facturaFile);

      const res = await api.post("/tramites", form, {
        headers: {
          "Content-Type": "multipart/form-data",
          Accept: "application/json",
        },
      });

      const data = res.data;

      // Si backend devuelve algo inesperado, caemos a mock en auto
      if (!looksValidCreateResponse(data)) {
        throw new Error("INVALID_CREATE_RESPONSE");
      }

      return data;
    },
    () => mockCreate(input),
    looksValidCreateResponse
  );
}
