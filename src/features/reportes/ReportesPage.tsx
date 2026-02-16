import { Alert, Button, Card, Input, Select, Space, Typography, message } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { toCsv, downloadTextFile } from "../../utils/csv";
import { getAtrasados } from "../../api/atrasados";
import { listTramites } from "../../api/tramites";
import { MOCK_CONCESIONARIOS, MOCK_CIUDADES } from "../../api/mocks";

import type { TramiteEstado, TramiteListItem, PaginatedResponse } from "../../api/types";

const ESTADOS: { value: TramiteEstado; label: string }[] = [
  { value: "FACTURA_RECIBIDA", label: "Factura recibida" },
  { value: "PREASIGNACION_SOLICITADA", label: "Preasignación solicitada" },
  { value: "PLACA_ASIGNADA", label: "Placa asignada" },
  { value: "PLACA_ENVIADA_CONCESIONARIO", label: "Placa enviada" },
  { value: "DOCS_FISICOS_PENDIENTES", label: "Docs físicos pendientes" },
  { value: "DOCS_FISICOS_COMPLETOS", label: "Docs físicos completos" },
  { value: "ENVIADO_GESTOR_TRANSITO", label: "Enviado a gestor" },
  { value: "TIMBRE_PAGADO", label: "Timbre pagado" },
  { value: "DERECHOS_PAGADOS", label: "Derechos pagados" },
  { value: "FINALIZADO_ENTREGADO", label: "Finalizado" },
  { value: "CANCELADO", label: "Cancelado" },
];

export default function ReportesPage() {
  const [msgApi, ctx] = message.useMessage();

  // filtros “básicos” (MVP)
  const [year, setYear] = useState<string | undefined>(undefined);
  const [concesionario, setConcesionario] = useState<string | undefined>(undefined);
  const [estado, setEstado] = useState<TramiteEstado | undefined>(undefined);
  const [placa, setPlaca] = useState<string>("");
  const [clienteDoc, setClienteDoc] = useState<string>("");

  // ✅ Bandeja para export (usamos pageSize grande; backend puede limitar)
  const bandejaQuery = useQuery<PaginatedResponse<TramiteListItem>>({
    queryKey: ["reporteTramites", { year, concesionario, estado, placa, clienteDoc }],
    queryFn: () =>
      listTramites({
        page: 1,
        pageSize: 2000,
        year: year ? Number(year) : undefined,
        concesionarioCode: concesionario,
        estado: estado,
        placa: placa.trim() || undefined,
        clienteDoc: clienteDoc.trim() || undefined,
      }),
  });

  const atrasadosQuery = useQuery({
    queryKey: ["reporteAtrasados"],
    queryFn: () => getAtrasados(),
  });

  const bandejaItems = bandejaQuery.data?.items ?? [];
  const atrasadosItems = atrasadosQuery.data ?? [];

  const exportBandeja = () => {
    const rows = bandejaItems.map((t) => ({
      id: t.id,
      display_id: t.display_id,
      year: t.year,
      concesionario_code: t.concesionario_code,
      consecutivo: t.consecutivo,
      estado_actual: t.estado_actual,
      placa: t.placa ?? "",
      ciudad: t.ciudad_nombre ?? "",
      cliente_nombre: t.cliente_nombre ?? "",
      cliente_doc: t.cliente_doc ?? "",
      created_at: t.created_at ?? "",
      is_atrasado: t.is_atrasado ? "SI" : "NO",
    }));

    const headers = [
      "id",
      "display_id",
      "year",
      "concesionario_code",
      "consecutivo",
      "estado_actual",
      "placa",
      "ciudad",
      "cliente_nombre",
      "cliente_doc",
      "created_at",
      "is_atrasado",
    ];

    const csv = toCsv(rows, headers);
    downloadTextFile(`reporte_bandeja_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    msgApi.success(`Exportado: ${rows.length} filas`);
  };

  const exportAtrasados = () => {
    const rows = atrasadosItems.map((a: any) => ({
      display_id: a.tramite.display_id,
      daysLate: a.daysLate,
      rule: a.rule,
      estado_actual: a.tramite.estado_actual,
      concesionario_code: a.tramite.concesionario_code,
      ciudad: a.tramite.ciudad_nombre ?? "",
      placa: a.tramite.placa ?? "",
      cliente_doc: a.tramite.cliente_doc ?? "",
    }));

    const headers = [
      "display_id",
      "daysLate",
      "rule",
      "estado_actual",
      "concesionario_code",
      "ciudad",
      "placa",
      "cliente_doc",
    ];

    const csv = toCsv(rows, headers);
    downloadTextFile(`reporte_atrasados_${new Date().toISOString().slice(0, 10)}.csv`, csv);
    msgApi.success(`Exportado: ${rows.length} filas`);
  };

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Reportes
        </Typography.Title>

        <Alert
          type="info"
          showIcon
          message="Exportación CSV (MVP)"
          description="Estos reportes usan la misma data de la app (AUTO: backend si responde, si no mocks)."
        />

        <Card title="Reporte Bandeja (CSV)">
          <Space wrap style={{ width: "100%" }} align="start">
            <Select
              style={{ width: 140 }}
              placeholder="Año"
              allowClear
              value={year}
              onChange={(v) => setYear(v)}
              options={[
                { value: "2026", label: "2026" },
                { value: "2025", label: "2025" },
              ]}
            />

            <Select
              style={{ width: 220 }}
              placeholder="Concesionario"
              allowClear
              value={concesionario}
              onChange={(v) => setConcesionario(v)}
              options={MOCK_CONCESIONARIOS.map((c) => ({ value: c.code, label: c.name }))}
            />

            <Select
              style={{ width: 220 }}
              placeholder="Estado"
              allowClear
              value={estado}
              onChange={(v) => setEstado(v)}
              options={ESTADOS.map((e) => ({ value: e.value, label: e.label }))}
            />

            <Input
              style={{ width: 180 }}
              placeholder="Placa"
              value={placa}
              onChange={(e) => setPlaca(e.target.value)}
              allowClear
            />

            <Input
              style={{ width: 200 }}
              placeholder="Cliente doc"
              value={clienteDoc}
              onChange={(e) => setClienteDoc(e.target.value)}
              allowClear
            />

            <Button
              icon={<DownloadOutlined />}
              type="primary"
              loading={bandejaQuery.isLoading}
              onClick={exportBandeja}
              disabled={bandejaItems.length === 0}
            >
              Exportar CSV ({bandejaItems.length})
            </Button>
          </Space>
        </Card>

        <Card title="Reporte Atrasados (CSV)">
          <Space wrap style={{ width: "100%" }} align="start">
            <Button
              icon={<DownloadOutlined />}
              type="primary"
              loading={atrasadosQuery.isLoading}
              onClick={exportAtrasados}
              disabled={atrasadosItems.length === 0}
            >
              Exportar CSV ({atrasadosItems.length})
            </Button>
          </Space>
        </Card>
      </Space>
    </>
  );
}
