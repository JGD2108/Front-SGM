// src/features/servicios/tabs/ServicioEstadosTab.tsx
import { Alert, Button, Card, Form, Select, Space, Table, Typography, message, Input } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { changeServicioEstado, getServicioEstadoHist, type ServicioEstado, type EstadoHistItem } from "../../../api/servicios";

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

export default function ServicioEstadosTab(props: {
  servicioId: string;
  locked: boolean;
  estadoActual?: ServicioEstado;
}) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<{ toEstado: ServicioEstado; notes?: string }>();

  const histQuery = useQuery({
    queryKey: ["servicioEstadoHist", props.servicioId],
    queryFn: () => getServicioEstadoHist(props.servicioId),
  });

  const mut = useMutation({
    mutationFn: (v: { toEstado: ServicioEstado; notes?: string }) =>
      changeServicioEstado(props.servicioId, v),
    onSuccess: () => {
      msgApi.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] });
      qc.invalidateQueries({ queryKey: ["servicioEstadoHist", props.servicioId] });
      form.resetFields(["notes"]);
    },
    onError: (e: any) => {
      if (e?.response?.status === 409) {
        msgApi.error("Servicio bloqueado.");
        return;
      }
      msgApi.error(e?.response?.data?.message ?? "No se pudo cambiar el estado");
    },
  });

  const cols: ColumnsType<EstadoHistItem> = [
    {
      title: "Fecha",
      dataIndex: "changed_at",
      key: "changed_at",
      width: 190,
      render: (iso: string) => (iso ? dayjs(iso).format("YYYY-MM-DD HH:mm") : "—"),
    },
    { title: "Usuario", dataIndex: "changed_by", key: "changed_by", width: 160 },
    {
      title: "Cambio",
      key: "change",
      width: 260,
      render: (_, r) => `${r.from_estado_servicio ?? "—"} → ${r.to_estado_servicio}`,
    },
    { title: "Tipo", dataIndex: "action_type", key: "action_type", width: 120 },
    { title: "Notas", dataIndex: "notes", key: "notes" },
  ];

  return (
    <>
      {ctx}

      {props.locked ? (
        <Alert type="warning" showIcon message="Estados bloqueados" description="Servicio ENTREGADO/CANCELADO." />
      ) : null}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Card title="Cambiar estado">
          <Form
            form={form}
            layout="vertical"
            initialValues={{ toEstado: props.estadoActual ?? "RECIBIDO" }}
            disabled={props.locked || mut.isPending}
          >
            <Form.Item label="Nuevo estado" name="toEstado" rules={[{ required: true }]}>
              <Select options={ESTADOS.map((e) => ({ value: e, label: e }))} />
            </Form.Item>

            <Form.Item label="Notas (opcional)" name="notes">
              <Input.TextArea rows={3} />
            </Form.Item>

            <Button type="primary" onClick={async () => mut.mutate(await form.validateFields())} loading={mut.isPending}>
              Cambiar estado
            </Button>
          </Form>
        </Card>

        <Card title="Historial" loading={histQuery.isLoading}>
          <Table<EstadoHistItem>
            rowKey={(r, idx) => `${r.changed_at}-${idx}`}
            columns={cols}
            dataSource={histQuery.data ?? []}
            pagination={false}
            scroll={{ x: 1000 }}
          />
        </Card>
      </Space>
    </>
  );
}
