// src/api/servicioUtils.ts
import type { ServicioTemplate } from "./servicioTemplates";


/**
 * Inicializa serviceData con llaves del template para evitar undefined.
 * - text/textarea/date/select => ""
 * - number => "" (para que InputNumber/Form no se rompa si llega null; luego lo sanitizamos)
 */
export function buildInitialServiceData(template: ServicioTemplate): Record<string, any> {
  const out: Record<string, any> = {};
  for (const f of template.campos ?? []) {
    if (f.type === "number") out[f.key] = "";
    else out[f.key] = "";
  }
  return out;
}

/**
 * Convierte el form values a un serviceData listo para PATCH.
 * - trim strings
 * - number: convierte a number si tiene valor, si no => null/undefined (aquí lo dejamos como undefined para no ensuciar)
 * - date: deja string "YYYY-MM-DD" tal cual (si viene vacío => undefined)
 */
export function sanitizeServiceDataForSave(
  template: ServicioTemplate,
  raw: Record<string, any>
): Record<string, any> {
  const out: Record<string, any> = {};
  const fields = template.campos ?? [];

  for (const f of fields) {
    const v = raw?.[f.key];

    if (f.type === "number") {
      if (v === "" || v === null || v === undefined) {
        out[f.key] = undefined;
      } else {
        const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, ""));
        out[f.key] = Number.isFinite(n) ? n : undefined;
      }
      continue;
    }

    if (f.type === "text" || f.type === "textarea" || f.type === "select" || f.type === "date") {
      if (v === null || v === undefined) {
        out[f.key] = undefined;
      } else {
        const s = String(v);
        const cleaned = s.trim();
        out[f.key] = cleaned.length ? cleaned : undefined;
      }
      continue;
    }

    // fallback
    out[f.key] = v;
  }

  // IMPORTANTE: quita undefined para enviar un JSON limpio
  for (const k of Object.keys(out)) {
    if (out[k] === undefined) delete out[k];
  }

  return out;
}
