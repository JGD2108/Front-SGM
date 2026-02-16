export type TramiteEstado =
  | "FACTURA_RECIBIDA"
  | "PREASIGNACION_SOLICITADA"
  | "PLACA_ASIGNADA"
  | "PLACA_ENVIADA_CONCESIONARIO"
  | "DOCS_FISICOS_PENDIENTES"
  | "DOCS_FISICOS_COMPLETOS"
  | "ENVIADO_GESTOR_TRANSITO"
  | "TIMBRE_PAGADO"
  | "DERECHOS_PAGADOS"
  | "FINALIZADO_ENTREGADO"
  | "CANCELADO";

export type TramiteListItem = {
  id: string;
  display_id: string;
  estado_actual: TramiteEstado;
  placa?: string | null;

  year: number;
  consecutivo: number;

  concesionario_code: string;
  concesionario_nombre?: string | null;

  ciudad_nombre?: string | null;

  cliente_doc?: string | null;
  cliente_nombre?: string | null;

  created_at: string; // ISO
  is_atrasado?: boolean; // si backend lo manda (ideal)
};

export type PaginatedResponse<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};
