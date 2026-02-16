// src/api/tramiteEnvios.ts
import { api } from "./http";
import { withFallback } from "./fallback";

export type Shipment = {
  id: string;
  numero_guia: string;
  transportadora: string;
  costo: number;
  fecha_envio: string; // YYYY-MM-DD
  notes?: string | null;
};

export type CreateShipmentInput = {
  numero_guia: string;
  transportadora: string;
  costo: number;
  fecha_envio: string; // YYYY-MM-DD
  notes?: string;
};

// ===== Mock store interno (solo si backend falla) =====
const mockShipments = new Map<string, Shipment>();
const mockLinksByTramite = new Map<string, string[]>();

function ensureLinks(tramiteId: string) {
  if (!mockLinksByTramite.has(tramiteId)) mockLinksByTramite.set(tramiteId, []);
}
function addMockShipment(s: Shipment) {
  mockShipments.set(s.id, s);
  return s;
}
function linkMock(tramiteId: string, shipmentId: string) {
  ensureLinks(tramiteId);
  const arr = mockLinksByTramite.get(tramiteId)!;
  if (!arr.includes(shipmentId)) arr.push(shipmentId);
}
function unlinkMock(tramiteId: string, shipmentId: string) {
  ensureLinks(tramiteId);
  const arr = mockLinksByTramite.get(tramiteId)!;
  mockLinksByTramite.set(tramiteId, arr.filter((x) => x !== shipmentId));
}
function getMockShipmentsForTramite(tramiteId: string): Shipment[] {
  ensureLinks(tramiteId);
  const ids = mockLinksByTramite.get(tramiteId)!;
  return ids.map((id) => mockShipments.get(id)).filter(Boolean) as Shipment[];
}

function looksLikeShipment(x: any): x is Shipment {
  return !!x && typeof x.id === "string" && typeof x.numero_guia === "string" && typeof x.transportadora === "string";
}
function looksLikeShipmentArray(x: any): x is Shipment[] {
  return Array.isArray(x) && (x.length === 0 || looksLikeShipment(x[0]));
}

// =====================
// API REAL + FALLBACK
// =====================

export async function listShipments(): Promise<Shipment[]> {
  return withFallback(
    async () => {
      const res = await api.get(`/shipments`, { headers: { Accept: "application/json" } });
      if (!Array.isArray(res.data)) throw new Error("INVALID_SHIPMENTS");
      return res.data;
    },
    () => Array.from(mockShipments.values()),
    (d) => Array.isArray(d)
  );
}

export async function listShipmentsForTramite(tramiteId: string): Promise<Shipment[]> {
  // ✅ tu backend NO tiene GET /tramites/:id/shipments
  // ✅ pero sí tiene GET /shipments?tramiteId=...
  return withFallback(
    async () => {
      const res = await api.get(`/shipments`, {
        params: { tramiteId },
        headers: { Accept: "application/json" },
      });
      if (!Array.isArray(res.data)) throw new Error("INVALID_SHIPMENTS");
      return res.data;
    },
    () => getMockShipmentsForTramite(tramiteId),
    (d) => Array.isArray(d)
  );
}

export async function createShipment(input: CreateShipmentInput): Promise<Shipment> {
  return withFallback(
    async () => {
      const res = await api.post(`/shipments`, input, { headers: { Accept: "application/json" } });
      if (!looksLikeShipment(res.data)) throw new Error("INVALID_SHIPMENT_CREATE");
      return res.data;
    },
    () => {
      const s: Shipment = {
        id: `S-${Date.now()}`,
        numero_guia: input.numero_guia,
        transportadora: input.transportadora,
        costo: Number(input.costo) || 0,
        fecha_envio: input.fecha_envio,
        notes: input.notes ?? "",
      };
      return addMockShipment(s);
    },
    (d) => looksLikeShipment(d)
  );
}

export async function linkShipment(tramiteId: string, shipmentId: string): Promise<{ ok: true }> {
  return withFallback(
    async () => {
      await api.post(
        `/shipments/${shipmentId}/tramites`,
        { tramiteId, action: "ADD" }, // ✅ OBLIGATORIO
        { headers: { Accept: "application/json" } }
      );
      return { ok: true };
    },
    () => {
      linkMock(tramiteId, shipmentId);
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}

export async function unlinkShipment(tramiteId: string, shipmentId: string): Promise<{ ok: true }> {
  return withFallback(
    async () => {
      await api.post(
        `/shipments/${shipmentId}/tramites`,
        { tramiteId, action: "REMOVE" }, // ✅ OBLIGATORIO
        { headers: { Accept: "application/json" } }
      );
      return { ok: true };
    },
    () => {
      unlinkMock(tramiteId, shipmentId);
      return { ok: true };
    },
    (d) => !!d && (d as any).ok === true
  );
}

export async function createShipmentAndLink(tramiteId: string, input: CreateShipmentInput): Promise<Shipment> {
  // ✅ aquí ya no devolvemos {shipment, ok}; devolvemos Shipment directo
  const shipment = await createShipment(input);

  // OJO: si esto es mock, shipment.id será S-... y el link real fallará => fallback lo cubrirá
  await linkShipment(tramiteId, shipment.id);

  return shipment;
}
