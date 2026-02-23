export type CuentaCobroRowKey =
  | "impuesto_timbre"
  | "impuesto_transito"
  | "matricula"
  | "servicio"
  | "envio_1"
  | "envio_2"
  | "pago_multas";

export type CuentaCobroRowTemplate = {
  id: CuentaCobroRowKey;
  nombre: string;
  has4x1000: boolean;
};

function normalizeText(raw: unknown): string {
  return String(raw ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildCuentaCobroRowTemplates(serviceLabel: string): CuentaCobroRowTemplate[] {
  const servicioName = String(serviceLabel || "").trim() || "Servicio";
  return [
    { id: "impuesto_timbre", nombre: "Impuesto de Timbre", has4x1000: true },
    { id: "impuesto_transito", nombre: "Impuesto de Transito", has4x1000: true },
    { id: "matricula", nombre: "Matricula", has4x1000: true },
    { id: "servicio", nombre: servicioName, has4x1000: true },
    { id: "envio_1", nombre: "Envio", has4x1000: true },
    { id: "envio_2", nombre: "Otro envio", has4x1000: false },
    { id: "pago_multas", nombre: "Pago de multas", has4x1000: false },
  ];
}

function isEnvio2Label(norm: string): boolean {
  return (
    norm.includes("envio 2") ||
    norm.includes("segundo envio") ||
    norm.includes("otro envio") ||
    norm.includes("envio adicional")
  );
}

export function matchCuentaCobroRowKey(
  rawIdOrName: unknown,
  options?: { serviceLabel?: string; usedKeys?: Set<CuentaCobroRowKey> }
): CuentaCobroRowKey | null {
  const value = normalizeText(rawIdOrName);
  if (!value) return null;

  const serviceNorm = normalizeText(options?.serviceLabel);
  const used = options?.usedKeys;

  const pickIfFree = (key: CuentaCobroRowKey): CuentaCobroRowKey | null => {
    if (used?.has(key)) return null;
    used?.add(key);
    return key;
  };

  if (value.includes("timbre")) return pickIfFree("impuesto_timbre");
  if (value.includes("transito")) return pickIfFree("impuesto_transito");
  if (value.includes("matricula")) return pickIfFree("matricula");
  if (value.includes("multa")) return pickIfFree("pago_multas");
  if (value.includes("envio")) {
    if (isEnvio2Label(value)) return pickIfFree("envio_2");
    if (used?.has("envio_1")) return pickIfFree("envio_2") ?? pickIfFree("envio_1");
    return pickIfFree("envio_1");
  }

  if (serviceNorm && (value === serviceNorm || value.includes(serviceNorm) || serviceNorm.includes(value))) {
    return pickIfFree("servicio");
  }

  if (value.includes("servicio") || value.includes("tramite")) return pickIfFree("servicio");

  return null;
}

