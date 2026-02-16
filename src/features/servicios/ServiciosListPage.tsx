// src/features/servicios/ServiciosListPage.tsx
import { Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";

import { getServicioTemplates } from "../../api/servicioTemplates";
import { listServicios, type ServicioListItem, type ServiciosListFilters, type ServicioEstado } from "../../api/servicios";

const ESTADOS: ServicioEstado[] = [
  "RECIBIDO",
  "EN_REVISION",
  "PENDIENTE_DOCUMENTOS",
  "PENDIENTE_PAGOS",
  "RADICADO",
  "EN_TRAMITE",
  "LISTO_PARA_ENTREGA",
  "ENTREGADO",
  "CANCELADO",
];

function estadoTag(e: string) {
  if (e === "ENTREGADO") return <Tag color="green">ENTREGADO</Tag>;
  if (e === "CANCELADO") return <Tag color="red">CANCELADO</Tag>;
  return <Tag>{e}</Tag>;
}

export default function ServiciosListPage() {
  const nav = useNavigate();
  const [form] = Form.useForm<ServiciosListFilters>();

  const templatesQuery = useQuery({
    queryKey: ["servicioTemplates"],
    queryFn: getServicioTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const filters = Form.useWatch([], form) as ServiciosListFilters | undefined;

  const listQuery = useQuery({
    queryKey: ["servicios", filters],
    queryFn: () => listServicios(filters ?? { page: 1, pageSize: 20 }),
  });

  const tipoLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of templatesQuery.data ?? []) map.set(t.tipo, t.nombre);
    return map;
  }, [templatesQuery.data]);

  const columns: ColumnsType<ServicioListItem> = [
    { title: "ID", dataIndex: "display_id", key: "display_id", width: 180 },
    {
      title: "Tipo",
      dataIndex: "tipo_servicio",
      key: "tipo_servicio",
      width: 200,
      render: (v: string) => tipoLabel.get(v) ?? v,
    },
    {
      title: "Estado",
      dataIndex: "estado_servicio",
      key: "estado_servicio",
      width: 160,
      render: (v: string) => estadoTag(v),
    },
    { title: "Cliente", dataIndex: "cliente_nombre", key: "cliente_nombre", width: 220 },
    { title: "Doc", dataIndex: "cliente_doc", key: "cliente_doc", width: 160 },
    { title: "Ciudad", dataIndex: "ciudad_nombre", key: "ciudad_nombre", width: 160 },
    { title: "Gestor", dataIndex: "gestor_nombre", key: "gestor_nombre", width: 180, render: (v) => v ?? "—" },
    {
      title: "Creado",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (iso: string) => (iso ? dayjs(iso).format("YYYY-MM-DD") : "—"),
    },
    {
      title: "Acción",
      key: "action",
      width: 120,
      render: (_, r) => (
        <Button type="link" onClick={() => nav(`/servicios/${r.id}`)}>
          Ver
        </Button>
      ),
    },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space style={{ justifyContent: "space-between", width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Servicios
        </Typography.Title>

        <Button type="primary" onClick={() => nav(`/servicios/nuevo`)}>
          Nuevo servicio
        </Button>
      </Space>

      <Card title="Filtros">
        <Form
          form={form}
          layout="vertical"
          initialValues={{ page: 1, pageSize: 20, includeCancelados: false }}
        >
          <Space wrap style={{ width: "100%" }} size={12}>
            <Form.Item label="Concesionario" name="concesionarioCode" style={{ width: 200 }}>
              <Input placeholder="Ej: AUTOTROPICAL" />
            </Form.Item>

            <Form.Item label="Ciudad" name="ciudad" style={{ width: 200 }}>
              <Input placeholder="Ej: Barranquilla" />
            </Form.Item>

            <Form.Item label="Tipo servicio" name="tipoServicio" style={{ width: 220 }}>
              <Select
                allowClear
                loading={templatesQuery.isLoading}
                options={(templatesQuery.data ?? []).map((t) => ({ value: t.tipo, label: t.nombre }))}
              />
            </Form.Item>

            <Form.Item label="Estado" name="estadoServicio" style={{ width: 220 }}>
              <Select allowClear options={ESTADOS.map((e) => ({ value: e, label: e }))} />
            </Form.Item>

            <Form.Item label="Cliente doc" name="clienteDoc" style={{ width: 200 }}>
              <Input placeholder="CC / NIT" />
            </Form.Item>
          </Space>
        </Form>
      </Card>

      <Card title="Bandeja" loading={listQuery.isLoading}>
        <Table<ServicioListItem>
          rowKey="id"
          columns={columns}
          dataSource={listQuery.data?.items ?? []}
          pagination={false}
          scroll={{ x: 1400 }}
        />
      </Card>
    </Space>
  );
}
