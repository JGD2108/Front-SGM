// src/features/tray/TramitesListPage.tsx
import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { DownloadOutlined } from "@ant-design/icons";
import { toCsv, downloadTextFile } from "../../utils/csv";

import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
  Spin,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";

import { listTramites } from "../../api/tramites";
import { getConcesionarios, getCiudades } from "../../api/catalogs";
import type { PaginatedResponse, TramiteEstado, TramiteListItem } from "../../api/types";

import { USE_MOCKS } from "../../api/config";
import { MOCK_CONCESIONARIOS, MOCK_CIUDADES } from "../../api/mocks";

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

function estadoTag(estado: TramiteEstado) {
  if (estado === "FINALIZADO_ENTREGADO") return <Tag color="green">Finalizado</Tag>;
  if (estado === "CANCELADO") return <Tag color="red">Cancelado</Tag>;
  return <Tag>{estado}</Tag>;
}

type Filters = {
  placa?: string;
  year?: string;
  concesionarioCode?: string;
  estado?: TramiteEstado;
  clienteDoc?: string;
  ciudad?: string;
  consecutivo?: string;
  createdRange?: [dayjs.Dayjs, dayjs.Dayjs];
  includeCancelados?: boolean;
};

export default function TramitesListPage() {
  const nav = useNavigate();
  const [form] = Form.useForm<Filters>();
  const [msgApi, contextHolder] = message.useMessage();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Catálogos (cuando haya backend). En mocks, igual los pedimos pero NO dependemos de ellos.
  const concesQuery = useQuery({
    queryKey: ["catalogs", "concesionarios"],
    queryFn: getConcesionarios,
    staleTime: 1000 * 60 * 10,
  });

  const ciudadesQuery = useQuery({
    queryKey: ["catalogs", "ciudades"],
    queryFn: getCiudades,
    staleTime: 1000 * 60 * 10,
  });

  // Leer filtros
  const filters = Form.useWatch([], form) as Filters | undefined;

  const params = useMemo(() => {
    const createdRange = filters?.createdRange;

    return {
      page,
      pageSize,
      placa: filters?.placa?.trim() || undefined,
      year: filters?.year ? Number(filters.year) : undefined,
      concesionarioCode: filters?.concesionarioCode || undefined,
      consecutivo: filters?.consecutivo ? Number(filters.consecutivo) : undefined,
      clienteDoc: filters?.clienteDoc?.trim() || undefined,
      ciudad: filters?.ciudad || undefined,
      estado: filters?.estado || undefined,
      createdFrom: createdRange?.[0] ? createdRange[0].format("YYYY-MM-DD") : undefined,
      createdTo: createdRange?.[1] ? createdRange[1].format("YYYY-MM-DD") : undefined,
      includeCancelados: !!filters?.includeCancelados,
    };
  }, [filters, page, pageSize]);

  // Trámites
  const tramitesQuery = useQuery<PaginatedResponse<TramiteListItem>>({
    queryKey: ["tramites", params],
    queryFn: () => listTramites(params),
    placeholderData: keepPreviousData, // ✅ TanStack Query v5
  });

  // Export CSV (usa EXACTAMENTE los items actuales de la consulta)
  const exportCsv = () => {
    const items = tramitesQuery.data?.items ?? [];
    const rows = items.map((t) => ({
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
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(`bandeja_${today}.csv`, csv);
    msgApi.success(`CSV exportado (${rows.length})`);
  };

  // ====== OPCIONES "A PRUEBA DE TODO" ======

  // 1) Si estamos en mocks, usamos los mocks directos SIEMPRE
  // 2) Si no, usamos data del backend si es array
  const concesionariosSafe = USE_MOCKS
    ? MOCK_CONCESIONARIOS
    : Array.isArray(concesQuery.data)
      ? concesQuery.data
      : [];

  const ciudadesSafe = USE_MOCKS
    ? MOCK_CIUDADES
    : Array.isArray(ciudadesQuery.data)
      ? ciudadesQuery.data
      : [];

  // Fallback: si por lo que sea no hay concesionarios cargados, sacarlos de lo que ya viene en la tabla
  const concesionariosFromTable = useMemo(() => {
    const codes = (tramitesQuery.data?.items ?? [])
      .map((t) => t.concesionario_code)
      .filter(Boolean);

    const unique = Array.from(new Set(codes));
    return unique.map((code) => ({ code, name: code }));
  }, [tramitesQuery.data]);

  const concesionariosFinal =
    concesionariosSafe.length > 0 ? concesionariosSafe : concesionariosFromTable;

  // ====== COLUMNAS ======
  const columns: ColumnsType<TramiteListItem> = [
    { title: "ID", dataIndex: "display_id", key: "display_id", width: 240 },
    {
      title: "Estado",
      dataIndex: "estado_actual",
      key: "estado_actual",
      render: (v: TramiteEstado, row) => (
        <Space>
          {estadoTag(v)}
          {row.is_atrasado ? <Tag color="orange">Atrasado</Tag> : null}
        </Space>
      ),
      width: 260,
    },
    { title: "Placa", dataIndex: "placa", key: "placa", width: 130 },
    { title: "Concesionario", dataIndex: "concesionario_code", key: "concesionario_code", width: 170 },
    { title: "Ciudad", dataIndex: "ciudad_nombre", key: "ciudad_nombre", width: 160 },
    {
      title: "Cliente",
      key: "cliente",
      render: (_, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.cliente_nombre ?? "-"}</div>
          <div style={{ opacity: 0.75 }}>{r.cliente_doc ?? ""}</div>
        </div>
      ),
      width: 260,
    },
    {
      title: "Creación",
      dataIndex: "created_at",
      key: "created_at",
      width: 190,
      render: (iso: string) => {
        const d = dayjs(iso);
        return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : iso;
      },
    },
  ];

  const onTableChange = (p: TablePaginationConfig) => {
    const newPage = p.current ?? 1;
    const newPageSize = p.pageSize ?? 20;

    if (newPageSize !== pageSize) setPage(1);
    else setPage(newPage);

    setPageSize(newPageSize);
  };

  const resetFilters = () => {
    form.resetFields();
    setPage(1);
    setPageSize(20);
  };

  const applyFilters = async () => {
    setPage(1);
    msgApi.success("Filtros aplicados");
  };

  const isLoadingTop = tramitesQuery.isLoading && !tramitesQuery.data;

  return (
    <>
      {contextHolder}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Bandeja de trámites
          </Typography.Title>

          <Button
            icon={<DownloadOutlined />}
            onClick={exportCsv}
            disabled={(tramitesQuery.data?.items?.length ?? 0) === 0}
          >
            Exportar CSV
          </Button>
        </Space>

        <Card>
          <Form form={form} layout="vertical" initialValues={{ includeCancelados: false }}>
            <Space wrap align="start" size={12} style={{ width: "100%" }}>
              <Form.Item label="Placa" name="placa" style={{ width: 160 }}>
                <Input placeholder="ABC123" allowClear onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item label="Año" name="year" style={{ width: 120 }}>
                <Input placeholder="2026" allowClear onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item label="Concesionario" name="concesionarioCode" style={{ width: 260 }}>
                <Select
                  allowClear
                  showSearch
                  placeholder="Selecciona"
                  loading={!USE_MOCKS && concesQuery.isLoading}
                  options={concesionariosFinal.map((c) => ({ value: c.code, label: c.name }))}
                  onChange={() => setPage(1)}
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item label="Estado" name="estado" style={{ width: 220 }}>
                <Select allowClear options={ESTADOS} placeholder="Selecciona" onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item label="Cliente doc" name="clienteDoc" style={{ width: 200 }}>
                <Input placeholder="CC/NIT" allowClear onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item label="Ciudad" name="ciudad" style={{ width: 200 }}>
                <Select
                  allowClear
                  showSearch
                  placeholder="Selecciona"
                  loading={!USE_MOCKS && ciudadesQuery.isLoading}
                  options={ciudadesSafe.map((c) => ({ value: c.name, label: c.name }))}
                  onChange={() => setPage(1)}
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item label="Consecutivo" name="consecutivo" style={{ width: 140 }}>
                <Input placeholder="1" allowClear onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item label="Rango creación" name="createdRange" style={{ width: 280 }}>
                <DatePicker.RangePicker allowClear onChange={() => setPage(1)} />
              </Form.Item>

              <Form.Item
                label="Incluir cancelados"
                name="includeCancelados"
                valuePropName="checked"
                style={{ width: 180 }}
              >
                <Switch onChange={() => setPage(1)} />
              </Form.Item>

              <Space style={{ marginTop: 30 }}>
                <Button type="primary" onClick={applyFilters}>
                  Aplicar
                </Button>
                <Button onClick={resetFilters}>Limpiar</Button>
                <Button onClick={() => nav("/tramites/nuevo")}>Crear trámite</Button>
              </Space>
            </Space>
          </Form>
        </Card>

        <Card>
          {isLoadingTop ? (
            <div style={{ display: "grid", placeItems: "center", padding: 24 }}>
              <Spin />
            </div>
          ) : (
            <>
              <Table<TramiteListItem>
                rowKey="id"
                columns={columns}
                dataSource={tramitesQuery.data?.items ?? []}
                loading={tramitesQuery.isFetching}
                pagination={{
                  current: page,
                  pageSize,
                  total: tramitesQuery.data?.total ?? 0,
                  showSizeChanger: true,
                }}
                onChange={onTableChange}
                onRow={(record) => ({
                  onClick: () => nav(`/tramites/${record.id}`),
                })}
                scroll={{ x: 1400 }}
              />

              {tramitesQuery.isError ? (
                <div style={{ marginTop: 12, color: "crimson" }}>
                  Error cargando trámites. (En producción, si es 401 te sacará al login.)
                </div>
              ) : null}
            </>
          )}
        </Card>
      </Space>
    </>
  );
}
