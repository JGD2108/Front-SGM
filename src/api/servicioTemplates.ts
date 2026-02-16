// src/api/servicioTemplates.ts
import { api } from "./http";

/**
 * Tipos de campos para formularios dinámicos.
 */
export type FieldType = "text" | "number" | "date" | "textarea" | "select";

export type TemplateField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

export type ServicioTipo =
  | "TRASPASO"
  | "MATRICULA_INICIAL"
  | "DUPLICADO_PLACAS"
  | "LEVANTAR_PRENDA"
  | "INSCRIPCION_PRENDA"
  | "TRASPASO_Y_PRENDA"
  | string; // por si el backend agrega más tipos

export type ServicioTemplate = {
  tipo: ServicioTipo;
  nombre: string;
  descripcion?: string;
  campos: TemplateField[];
};

// ✅ Alias por compatibilidad si ya escribiste ServiceTemplate en otros archivos
export type ServiceTemplate = ServicioTemplate;

function normalizeTemplates(data: any): ServicioTemplate[] {
  const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : null;
  if (!items) return [];

  return items.map((t: any) => ({
    tipo: String(t?.tipo ?? ""),
    nombre: String(t?.nombre ?? ""),
    descripcion: t?.descripcion ? String(t.descripcion) : undefined,
    campos: Array.isArray(t?.campos)
      ? t.campos.map((c: any) => ({
          key: String(c?.key ?? ""),
          label: String(c?.label ?? c?.key ?? ""),
          type: c?.type as FieldType,
          required: !!c?.required,
          placeholder: c?.placeholder ? String(c.placeholder) : undefined,
          options: Array.isArray(c?.options) ? c.options.map((x: any) => String(x)) : undefined,
        }))
      : [],
  }));
}

/**
 * ✅ GET /servicios/templates
 */
export async function getServicioTemplates(): Promise<ServicioTemplate[]> {
  const res = await api.get(`/servicios/templates`, { headers: { Accept: "application/json" } });
  return normalizeTemplates(res.data);
}
