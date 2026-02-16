export type PaymentType = "TIMBRE" | "DERECHOS" | "OTRO";

export type PaymentRecord = {
  id: string;
  tramite_id: string;
  type: PaymentType;
  valor: number;
  fecha: string; // YYYY-MM-DD
  medio_pago?: string | null;
  cuenta?: string | null;
  notes?: string | null;

  // adjunto opcional
  attachment_file_id?: string | null;
  attachment_name?: string | null;

  created_at: string; // ISO
};

const paymentsByTramite = new Map<string, PaymentRecord[]>();

function newId() {
  return `P-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export function ensureMockPayments(tramiteId: string) {
  if (!paymentsByTramite.has(tramiteId)) paymentsByTramite.set(tramiteId, []);
}

export function getMockPayments(tramiteId: string): PaymentRecord[] {
  return paymentsByTramite.get(tramiteId) ?? [];
}

export function addMockPayment(tramiteId: string, p: Omit<PaymentRecord, "id" | "created_at">): PaymentRecord {
  ensureMockPayments(tramiteId);
  const list = paymentsByTramite.get(tramiteId)!;

  const rec: PaymentRecord = {
    ...p,
    id: newId(),
    created_at: new Date().toISOString(),
  };

  list.unshift(rec);
  paymentsByTramite.set(tramiteId, list);
  return rec;
}

export function deleteMockPayment(tramiteId: string, paymentId: string) {
  ensureMockPayments(tramiteId);
  const list = paymentsByTramite.get(tramiteId)!;
  paymentsByTramite.set(tramiteId, list.filter((x) => x.id !== paymentId));
}
