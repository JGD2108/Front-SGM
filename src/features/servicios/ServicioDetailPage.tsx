// src/features/servicios/ServicioDetailPage.tsx
import { Alert, Button, Card, Descriptions, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Tabs, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { getServicioTemplates, type ServicioTemplate } from "../../api/servicioTemplates";
import {
  changeServicioEstado,
  deleteServicio,
  getServicioById,
  getServicioEstadoHist,
  patchServicio,
  type ServicioEstado,
  type ServicioEstadoHistItem,
} from "../../api/servicios";
import { buildInitialServiceData, sanitizeServiceDataForSave } from "../../api/servicioUtils";
import ServicioPagosTab from "./tabs/ServicioPagosTab";

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

function estadoTag(e: ServicioEstado) {
  if (e === "ENTREGADO") return <Tag color="green">ENTREGADO</Tag>;
  if (e === "CANCELADO") return <Tag color="red">CANCELADO</Tag>;
  return <Tag>{e}</Tag>;
}

export default function ServicioDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  if (!id) return null;

  const templatesQuery = useQuery({
    queryKey: ["servicioTemplates"],
    queryFn: getServicioTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const servicioQuery = useQuery({
    queryKey: ["servicio", id],
    queryFn: () => getServicioById(id),
  });

  const histQuery = useQuery({
    queryKey: ["servicioHist", id],
    queryFn: () => getServicioEstadoHist(id),
  });

  const servicio = servicioQuery.data;
  const locked = servicio?.estado_servicio === "ENTREGADO" || servicio?.estado_servicio === "CANCELADO";

  const template: ServicioTemplate | undefined = useMemo(() => {
    const tipo = servicio?.tipo_servicio;
    if (!tipo) return undefined;
    return (templatesQuery.data ?? []).find((t) => t.tipo === tipo);
  }, [servicio?.tipo_servicio, templatesQuery.data]);

  // -------- Form dinámico (serviceData) --------
  const [dataForm] = Form.useForm<Record<string, any>>();
  const [metaForm] = Form.useForm<{ gestorNombre?: string; gestorTelefono?: string }>();

  // cuando carga servicio+template, inicializa forms
  useEffect(() => {
    if (!servicio || !template) return;

    const initialServiceData =
      servicio.service_data && typeof servicio.service_data === "object"
        ? servicio.service_data
        : buildInitialServiceData(template);

    dataForm.setFieldsValue(initialServiceData);

    metaForm.setFieldsValue({
      gestorNombre: servicio.gestor_nombre ?? undefined,
      gestorTelefono: servicio.gestor_telefono ?? undefined,
    });
  }, [servicio?.id, template?.tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const patchMut = useMutation({
    mutationFn: async () => {
      if (!template) throw new Error("NO_TEMPLATE");
      const raw = dataForm.getFieldsValue(true) as Record<string, any>;
      const meta = metaForm.getFieldsValue(true);

      const serviceData = sanitizeServiceDataForSave(template, raw);

      return patchServicio(id, {
        serviceData,
        gestorNombre: meta.gestorNombre,
        gestorTelefono: meta.gestorTelefono,
      });
    },
    onSuccess: () => {
      msgApi.success("Guardado");
      qc.invalidateQueries({ queryKey: ["servicio", id] });
    },
    onError: (err: any) => {
      msgApi.error(err?.response?.data?.message ?? "No se pudo guardar");
    },
  });

  const resetMut = useMutation({
    mutationFn: async () => patchServicio(id, { serviceData: null }),
    onSuccess: () => {
      msgApi.success("Formulario reiniciado");
      qc.invalidateQueries({ queryKey: ["servicio", id] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo resetear"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteServicio(id, { reason: deleteReason.trim() || undefined }),
    onSuccess: (r) => {
      msgApi.success(r.mode === "deleted" ? "Servicio eliminado" : "Servicio cancelado");
      setDeleteOpen(false);
      setDeleteReason("");
      qc.invalidateQueries({ queryKey: ["servicios"] });
      qc.invalidateQueries({ queryKey: ["servicio", id] });
      nav("/servicios");
    },
    onError: (err: any) => {
      msgApi.error(err?.response?.data?.message ?? "No se pudo eliminar el servicio");
    },
  });

  // -------- Estados --------
  const [estadoForm] = Form.useForm<{ toEstado: ServicioEstado; notes?: string }>();

  const estadoMut = useMutation({
    mutationFn: (v: { toEstado: ServicioEstado; notes?: string }) => changeServicioEstado(id, v),
    onSuccess: () => {
      msgApi.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["servicio", id] });
      qc.invalidateQueries({ queryKey: ["servicioHist", id] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo cambiar estado"),
  });
  const histCols: ColumnsType<ServicioEstadoHistItem> = [
    { title: "Fecha", dataIndex: "changed_at", key: "changed_at", width: 180, render: (iso: string) => (iso ? dayjs(iso).format("YYYY-MM-DD HH:mm") : "—") },
    { title: "Usuario", dataIndex: "changed_by", key: "changed_by", width: 160 },
    { title: "Cambio", key: "cambio", width: 260, render: (_, r) => `${r.from_estado_servicio ?? "—"} → ${r.to_estado_servicio}` },
    { title: "Tipo", dataIndex: "action_type", key: "action_type", width: 120 },
    { title: "Notas", dataIndex: "notes", key: "notes", render: (v) => v ?? "—" },
  ];

  const formFields = useMemo(() => {
    if (!template) return null;

    return template.campos.map((f) => {
      if (f.type === "text") {
        return (
          <Form.Item key={f.key} label={f.label} name={f.key} rules={f.required ? [{ required: true, message: "Obligatorio" }] : undefined}>
            <Input placeholder={f.placeholder ?? ""} />
          </Form.Item>
        );
      }

      if (f.type === "textarea") {
        return (
          <Form.Item key={f.key} label={f.label} name={f.key} rules={f.required ? [{ required: true, message: "Obligatorio" }] : undefined}>
            <Input.TextArea rows={3} placeholder={f.placeholder ?? ""} />
          </Form.Item>
        );
      }

      if (f.type === "number") {
        return (
          <Form.Item key={f.key} label={f.label} name={f.key} rules={f.required ? [{ required: true, message: "Obligatorio" }] : undefined}>
            <InputNumber style={{ width: "100%" }} min={0} />
          </Form.Item>
        );
      }

      if (f.type === "date") {
        return (
          <Form.Item key={f.key} label={f.label} name={f.key} rules={f.required ? [{ required: true, message: "Obligatorio" }] : undefined}>
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>
        );
      }

      if (f.type === "select") {
        return (
          <Form.Item key={f.key} label={f.label} name={f.key} rules={f.required ? [{ required: true, message: "Obligatorio" }] : undefined}>
            <Select
              allowClear={!f.required}
              options={(f.options ?? []).map((o) => ({ value: o, label: o }))}
              placeholder={f.placeholder ?? "Selecciona"}
            />
          </Form.Item>
        );
      }

      return null;
    });
  }, [template]);

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Detalle servicio
            </Typography.Title>
            {servicio ? (
              <Space style={{ marginTop: 4 }}>
                <Typography.Text strong>{servicio.display_id}</Typography.Text>
                {estadoTag(servicio.estado_servicio)}
                <Tag>{servicio.tipo_servicio}</Tag>
              </Space>
            ) : null}
          </div>

          <Space>
            <Button danger disabled={locked || !servicio} onClick={() => setDeleteOpen(true)}>
              Eliminar
            </Button>
            <Button onClick={() => nav("/servicios")}>Volver</Button>
          </Space>
        </Space>

        {locked ? (
          <Alert
            type="warning"
            showIcon
            message="Servicio bloqueado"
            description="Está ENTREGADO o CANCELADO. Solo lectura."
          />
        ) : null}

        <Card loading={servicioQuery.isLoading}>
          {servicio ? (
            <Descriptions column={3} size="small">
              <Descriptions.Item label="ID">{servicio.display_id}</Descriptions.Item>
              <Descriptions.Item label="Tipo">{template?.nombre ?? servicio.tipo_servicio}</Descriptions.Item>
              <Descriptions.Item label="Estado">{estadoTag(servicio.estado_servicio)}</Descriptions.Item>

              <Descriptions.Item label="Concesionario">{servicio.concesionario_code}</Descriptions.Item>
              <Descriptions.Item label="Ciudad">{servicio.ciudad_nombre}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{servicio.cliente_nombre} ({servicio.cliente_doc})</Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text>Sin datos</Typography.Text>
          )}
        </Card>

        <Card>
          <Tabs
            items={[
              {
                key: "datos",
                label: "Datos (Formulario)",
                children: (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    {!template ? (
                      <Alert type="error" showIcon message="No se encontró template para este tipo_servicio" />
                    ) : null}

                    <Card title="Gestor" size="small">
                      <Form form={metaForm} layout="vertical" disabled={locked}>
                        <Space wrap size={12} style={{ width: "100%" }}>
                          <Form.Item label="Gestor nombre" name="gestorNombre" style={{ width: 320 }}>
                            <Input placeholder="Opcional" />
                          </Form.Item>
                          <Form.Item label="Gestor teléfono" name="gestorTelefono" style={{ width: 240 }}>
                            <Input placeholder="Opcional" />
                          </Form.Item>
                        </Space>
                      </Form>
                    </Card>

                    <Card title={template?.nombre ?? "Formulario"} size="small">
                      <Form form={dataForm} layout="vertical" disabled={locked || !template}>
                        {template?.descripcion ? (
                          <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
                            {template.descripcion}
                          </Typography.Paragraph>
                        ) : null}

                        {formFields}

                        <Space>
                          <Button
                            type="primary"
                            disabled={locked || !template}
                            loading={patchMut.isPending}
                            onClick={async () => {
                              if (!template) return;
                              await dataForm.validateFields();
                              patchMut.mutate();
                            }}
                          >
                            Guardar
                          </Button>

                          <Button
                            danger
                            disabled={locked}
                            loading={resetMut.isPending}
                            onClick={() => resetMut.mutate()}
                          >
                            Reset (limpiar)
                          </Button>
                        </Space>
                      </Form>
                    </Card>
                  </Space>
                ),
              },
              {
                key: "pagos",
                label: "Pagos",
                children: (
                  <ServicioPagosTab
                    servicioId={id}
                    locked={locked}
                    servicio={servicio}
                    servicioLabel={template?.nombre ?? servicio?.tipo_servicio}
                  />
                ),
              },
              {
                key: "estados",
                label: "Estados / Historial",
                children: (
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <Card title="Cambiar estado" size="small">
                      <Form
                        form={estadoForm}
                        layout="vertical"
                        disabled={locked || estadoMut.isPending}
                        initialValues={{ toEstado: servicio?.estado_servicio ?? "RECIBIDO" }}
                      >
                        <Form.Item label="Nuevo estado" name="toEstado" rules={[{ required: true }]}>
                          <Select options={ESTADOS.map((e) => ({ value: e, label: e }))} />
                        </Form.Item>
                        <Form.Item label="Notas (opcional)" name="notes">
                          <Input.TextArea rows={3} />
                        </Form.Item>

                        <Button type="primary" onClick={async () => {
                          const v = await estadoForm.validateFields();
                          estadoMut.mutate(v);
                        }}>
                          Guardar cambio
                        </Button>
                      </Form>
                    </Card>

                    <Card title="Historial" loading={histQuery.isLoading}>
                      <Table<ServicioEstadoHistItem>
                        rowKey={(r, idx) => `${r.changed_at}-${idx}`}
                        columns={histCols}
                        dataSource={histQuery.data ?? []}
                        pagination={false}
                        scroll={{ x: 1000 }}
                      />
                    </Card>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Space>

      <Modal
        title="Eliminar servicio"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={() => deleteMut.mutate()}
        okText="Eliminar servicio"
        okButtonProps={{ danger: true, loading: deleteMut.isPending, disabled: locked || !servicio }}
      >
        <Typography.Paragraph>
          Esta accion intentara eliminar el servicio. Si el backend no soporta DELETE, se marcara como CANCELADO.
        </Typography.Paragraph>
        <Input.TextArea
          rows={3}
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
          placeholder="Motivo (opcional)"
          disabled={deleteMut.isPending}
        />
      </Modal>
    </>
  );
}


