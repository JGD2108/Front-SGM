// src/features/tramite/tabs/EnviosTab.tsx
import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { PlusOutlined, LinkOutlined, DisconnectOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  createShipmentAndLink,
  listShipments,
  listShipmentsForTramite,
  unlinkShipment,
  linkShipment,
  type Shipment,
  type CreateShipmentInput,
} from "../../../api/tramiteEnvios";

function money(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

export default function EnviosTab(props: { tramiteId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();

  const tramiteShipmentsQuery = useQuery({
    queryKey: ["tramiteShipments", props.tramiteId],
    queryFn: () => listShipmentsForTramite(props.tramiteId),
  });

  const allShipmentsQuery = useQuery({
    queryKey: ["shipmentsAll"],
    queryFn: () => listShipments(),
  });

  const linkedIds = useMemo(
    () => new Set((tramiteShipmentsQuery.data ?? []).map((s) => s.id)),
    [tramiteShipmentsQuery.data]
  );

  const linkable = useMemo(
    () => (allShipmentsQuery.data ?? []).filter((s) => !linkedIds.has(s.id)),
    [allShipmentsQuery.data, linkedIds]
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  const [createForm] = Form.useForm<CreateShipmentInput>();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  const totalEnvios = useMemo(
    () => (tramiteShipmentsQuery.data ?? []).reduce((acc, s) => acc + (Number(s.costo) || 0), 0),
    [tramiteShipmentsQuery.data]
  );

  // ✅ Crear + asociar
  const createMut = useMutation({
    mutationFn: (payload: CreateShipmentInput) => createShipmentAndLink(props.tramiteId, payload),
    onSuccess: () => {
      msgApi.success("Guía creada y asociada");
      setCreateOpen(false);
      createForm.resetFields();
      qc.invalidateQueries({ queryKey: ["tramiteShipments", props.tramiteId] });
      qc.invalidateQueries({ queryKey: ["shipmentsAll"] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo crear la guía"),
  });

  // ✅ Asociar existente
  const linkMut = useMutation({
    mutationFn: async () => {
      if (!selectedShipmentId) throw new Error("NO_SHIPMENT_SELECTED");
      return linkShipment(props.tramiteId, selectedShipmentId);
    },
    onSuccess: () => {
      msgApi.success("Guía asociada");
      setLinkOpen(false);
      setSelectedShipmentId(null);
      qc.invalidateQueries({ queryKey: ["tramiteShipments", props.tramiteId] });
      qc.invalidateQueries({ queryKey: ["shipmentsAll"] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo asociar"),
  });

  // ✅ Quitar asociación
  const unlinkMut = useMutation({
    mutationFn: (shipmentId: string) => unlinkShipment(props.tramiteId, shipmentId),
    onSuccess: () => {
      msgApi.success("Asociación removida");
      qc.invalidateQueries({ queryKey: ["tramiteShipments", props.tramiteId] });
      qc.invalidateQueries({ queryKey: ["shipmentsAll"] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo remover"),
  });

  const cols: ColumnsType<Shipment> = [
    {
      title: "Fecha",
      dataIndex: "fecha_envio",
      key: "fecha_envio",
      width: 130,
      render: (v: string) => {
        // backend manda YYYY-MM-DD
        const d = dayjs(v, "YYYY-MM-DD", true);
        return d.isValid() ? d.format("YYYY-MM-DD") : (v ?? "—");
      },
    },
    { title: "Guía", dataIndex: "numero_guia", key: "numero_guia", width: 180, render: (v) => v ?? "—" },
    { title: "Transportadora", dataIndex: "transportadora", key: "transportadora", width: 220, render: (v) => v ?? "—" },
    {
      title: "Costo",
      dataIndex: "costo",
      key: "costo",
      width: 150,
      render: (v: number) => <Typography.Text strong>{money(Number(v) || 0)}</Typography.Text>,
    },
    {
      title: "Notas",
      dataIndex: "notes",
      key: "notes",
      render: (v) => v ?? "—",
    },
    {
      title: "Acciones",
      key: "actions",
      width: 140,
      render: (_, s) => (
        <Button
          icon={<DisconnectOutlined />}
          danger
          disabled={props.locked}
          loading={unlinkMut.isPending}
          onClick={() => unlinkMut.mutate(s.id)}
        >
          Quitar
        </Button>
      ),
    },
  ];

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {props.locked ? (
          <Alert
            type="warning"
            showIcon
            message="Envíos bloqueados"
            description="El trámite está finalizado o cancelado. Solo puedes ver."
          />
        ) : (
          <Alert type="info" showIcon message="Envíos / Guías" description="Una guía puede agrupar trámites y viceversa." />
        )}

        <Card>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <Typography.Text>
              Total envíos asociados: <Typography.Text strong>{money(totalEnvios)}</Typography.Text>
            </Typography.Text>

            <Space>
              <Button icon={<PlusOutlined />} type="primary" disabled={props.locked} onClick={() => setCreateOpen(true)}>
                Crear guía
              </Button>
              <Button icon={<LinkOutlined />} disabled={props.locked} onClick={() => setLinkOpen(true)}>
                Asociar guía existente
              </Button>
            </Space>
          </Space>
        </Card>

        <Card title="Guías asociadas" loading={tramiteShipmentsQuery.isLoading}>
          <Table<Shipment>
            rowKey="id"
            columns={cols}
            dataSource={tramiteShipmentsQuery.data ?? []}
            pagination={false}
            scroll={{ x: 1100 }}
          />

          {tramiteShipmentsQuery.isError ? (
            <div style={{ marginTop: 12, color: "crimson" }}>
              Error cargando envíos. Revisa `GET /shipments?tramiteId=...` (token / CORS / baseURL).
            </div>
          ) : null}
        </Card>
      </Space>

      {/* Modal Crear */}
      <Modal
        title="Crear guía"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        okText="Crear y asociar"
        okButtonProps={{ loading: createMut.isPending }}
        onOk={async () => {
          const v = await createForm.validateFields();
          createMut.mutate(v);
        }}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{
            fecha_envio: dayjs().format("YYYY-MM-DD"),
            costo: 0,
          }}
        >
          <Form.Item label="Fecha envío" name="fecha_envio" rules={[{ required: true, message: "Ingresa la fecha" }]}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item label="Número guía" name="numero_guia" rules={[{ required: true, message: "Ingresa la guía" }]}>
            <Input placeholder="Ej: INT-001-ABC" />
          </Form.Item>

          <Form.Item label="Transportadora" name="transportadora" rules={[{ required: true, message: "Ingresa la transportadora" }]}>
            <Input placeholder="Ej: Interrapidísimo" />
          </Form.Item>

          <Form.Item label="Costo" name="costo" rules={[{ required: true, message: "Ingresa el costo" }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Notas (opcional)" name="notes">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal Asociar existente */}
      <Modal
        title="Asociar guía existente"
        open={linkOpen}
        onCancel={() => setLinkOpen(false)}
        okText="Asociar"
        okButtonProps={{ loading: linkMut.isPending, disabled: !selectedShipmentId }}
        onOk={() => linkMut.mutate()}
      >
        <Typography.Paragraph>Selecciona una guía existente para asociarla a este trámite.</Typography.Paragraph>

        <Select
          style={{ width: "100%" }}
          showSearch
          placeholder="Selecciona una guía"
          value={selectedShipmentId ?? undefined}
          onChange={(v) => setSelectedShipmentId(v)}
          options={(linkable ?? []).map((s) => ({
            value: s.id,
            label: `${s.numero_guia} — ${s.transportadora} — ${s.fecha_envio} — ${money(Number(s.costo) || 0)}`,
          }))}
          filterOption={(input, option) => String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())}
        />

        {linkable.length === 0 ? (
          <div style={{ marginTop: 10 }}>
            <Tag>No hay guías disponibles para asociar.</Tag>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
