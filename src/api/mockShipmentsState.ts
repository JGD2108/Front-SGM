export type Shipment = {
  id: string;
  fecha_envio: string; // YYYY-MM-DD
  numero_guia: string;
  transportadora: string;
  costo: number;
  notes?: string | null;
  created_at: string; // ISO
};

const shipments = new Map<string, Shipment>();
const shipmentToTramites = new Map<string, Set<string>>(); // shipmentId -> tramiteIds
const tramiteToShipments = new Map<string, Set<string>>(); // tramiteId -> shipmentIds

function newId() {
  return `S-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function listMockShipments(): Shipment[] {
  return Array.from(shipments.values()).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
}

export function getMockShipment(id: string): Shipment | null {
  return shipments.get(id) ?? null;
}

export function createMockShipment(payload: Omit<Shipment, "id" | "created_at">): Shipment {
  const rec: Shipment = { ...payload, id: newId(), created_at: new Date().toISOString() };
  shipments.set(rec.id, rec);
  if (!shipmentToTramites.has(rec.id)) shipmentToTramites.set(rec.id, new Set());
  return rec;
}

export function linkMockShipmentToTramite(shipmentId: string, tramiteId: string) {
  if (!shipmentToTramites.has(shipmentId)) shipmentToTramites.set(shipmentId, new Set());
  shipmentToTramites.get(shipmentId)!.add(tramiteId);

  if (!tramiteToShipments.has(tramiteId)) tramiteToShipments.set(tramiteId, new Set());
  tramiteToShipments.get(tramiteId)!.add(shipmentId);
}

export function unlinkMockShipmentFromTramite(shipmentId: string, tramiteId: string) {
  shipmentToTramites.get(shipmentId)?.delete(tramiteId);
  tramiteToShipments.get(tramiteId)?.delete(shipmentId);
}

export function listMockShipmentsForTramite(tramiteId: string): Shipment[] {
  const ids = Array.from(tramiteToShipments.get(tramiteId) ?? []);
  return ids
    .map((id) => shipments.get(id))
    .filter(Boolean) as Shipment[];
}

export function seedMockShipmentsIfEmpty() {
  if (shipments.size > 0) return;

  const s1 = createMockShipment({
    fecha_envio: "2026-01-10",
    numero_guia: "INT-001-ABC",
    transportadora: "Interrapidísimo",
    costo: 24000,
    notes: "Documentos físicos",
  });

  const s2 = createMockShipment({
    fecha_envio: "2026-01-12",
    numero_guia: "SERV-7781",
    transportadora: "Servientrega",
    costo: 32000,
    notes: "Placa enviada",
  });

  // quedan sin asociar, para probar “asociar existente”
  void s1; void s2;
}
