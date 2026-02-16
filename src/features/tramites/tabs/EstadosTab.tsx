// src/features/tramites/tabs/EstadosTab.tsx
import { Alert, Button, Card, Form, Input, Select, Space, Steps, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import type { TramiteEstado } from "../../../api/types";
import { changeEstado, getEstadoHist, type EstadoHistItem } from "../../../api/tramiteEstados";

const ORDER: TramiteEstado[] = [
  "FACTURA_RECIBIDA",
  "PREASIGNACION_SOLICITADA",
  "PLACA_ASIGNADA",
  "PLACA_ENVIADA_CONCESIONARIO",
  "DOCS_FISICOS_PENDIENTES",
  "DOCS_FISICOS_COMPLETOS",
  "ENVIADO_GESTOR_TRANSITO",
  "TIMBRE_PAGADO",
  "DERECHOS_PAGADOS",
  "FINALIZADO_ENTREGADO",
  "CANCELADO",
];

const ESTADOS_OPTIONS: { value: TramiteEstado; label: string }[] = [
  { value: "FACTURA_RECIBIDA", label: "Factura recibida" },
  { value: "PREASIGNACION_SOLICITADA", label: "Preasignación solicitada" },
  { value: "PLACA_ASIGNADA", label: "Placa asignada" },
  { value: "PLACA_ENVIADA_CONCESIONARIO", label: "Placa enviada" },
  { value: "DOCS_FISICOS_PENDIENTES", label: "Docs físicos pendientes" },
  { value: "DOCS_FISICOS_COMPLETOS", label: "Docs físicos completos" },
  { value: "ENVIADO_GESTOR_TRANSITO", label: "Enviado a gestor" },
  { value: "TIMBRE_PAGADO", label: "Timbre pagado" },
  { value: "DERECHOS_PAGADOS", label: "Derechos pagados" },
  // FINALIZADO/CANCELADO por botones del header
];

function indexOfEstado(e: TramiteEstado) {
  return ORDER.indexOf(e);
}

function normalizePlaca(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

type FormValues = {
  toEstado: TramiteEstado;
  notes?: string;
  placa?: string;
};

export default function EstadosTab(props: {
  tramiteId: string;
  estadoActual: TramiteEstado;
  locked: boolean; // FINALIZADO o CANCELADO
}) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<FormValues>();
  const [warning, setWarning] = useState<string | null>(null);

  const histQuery = useQuery({
    queryKey: ["tramiteEstadoHist", props.tramiteId],
    queryFn: () => getEstadoHist(props.tramiteId),
  });

  const toEstadoWatch = Form.useWatch("toEstado", form) as TramiteEstado | undefined;

  const mut = useMutation({
    mutationFn: async (values: FormValues) => {
      // ✅ SOLO manda placa cuando el estado sea PLACA_ASIGNADA
      const placaToSend =
        values.toEstado === "PLACA_ASIGNADA" && values.placa?.trim()
          ? normalizePlaca(values.placa)
          : undefined;

      return changeEstado(props.tramiteId, {
        toEstado: values.toEstado,
        notes: values.notes,
        placa: placaToSend,
      });
    },
    onSuccess: () => {
      msgApi.success("Estado actualizado");
      qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] });
      qc.invalidateQueries({ queryKey: ["tramiteEstadoHist", props.tramiteId] });
      setWarning(null);
      // deja toEstado, limpia notas y placa
      form.resetFields(["notes", "placa"]);
    },
    onError: (err: any) => {
      msgApi.error(err?.response?.data?.message ?? "No se pudo cambiar el estado");
    },
  });

  const stepsItems = useMemo(() => {
    return ORDER.filter((e) => e !== "CANCELADO").map((e) => ({ title: e }));
  }, []);

  const currentStep = Math.max(0, indexOfEstado(props.estadoActual));

  const columns: ColumnsType<EstadoHistItem> = [
    {
      title: "Fecha",
      dataIndex: "changed_at",
      key: "changed_at",
      width: 180,
      render: (iso: string) => {
        const d = dayjs(iso);
        return d.isValid() ? d.format("YYYY-MM-DD HH:mm") : iso;
      },
    },
    { title: "Usuario", dataIndex: "changed_by", key: "changed_by", width: 140 },
    { title: "Cambio", key: "change", render: (_, r) => `${r.from_estado ?? "—"} → ${r.to_estado}`, width: 260 },
    { title: "Tipo", dataIndex: "action_type", key: "action_type", width: 120 },
    { title: "Notas", dataIndex: "notes", key: "notes" },
  ];

  const onEstadoChange = (toEstado: TramiteEstado) => {
    const from = props.estadoActual;
    const fromIdx = indexOfEstado(from);
    const toIdx = indexOfEstado(toEstado);

    if (fromIdx >= 0 && toIdx >= 0) {
      const diff = Math.abs(toIdx - fromIdx);
      if (diff > 1) {
        setWarning("Estás saltando pasos recomendados. Puedes continuar, pero quedará registrado en el historial.");
      } else {
        setWarning(null);
      }
    } else {
      setWarning(null);
    }

    // ✅ si sales de PLACA_ASIGNADA, limpia placa
    if (toEstado !== "PLACA_ASIGNADA") {
      form.setFieldValue("placa", undefined);
    }
  };

  const submit = async () => {
    const values = await form.validateFields();

    // ✅ regla: placa obligatoria para PLACA_ASIGNADA
    if (values.toEstado === "PLACA_ASIGNADA") {
      const placaNorm = values.placa ? normalizePlaca(values.placa) : "";
      if (!placaNorm) {
        msgApi.error("Debes ingresar la placa para marcar 'PLACA_ASIGNADA'.");
        return;
      }
      // Validación básica de placa (ajusta si necesitas)
      if (!/^[A-Z0-9-]{5,10}$/.test(placaNorm)) {
        msgApi.error("Placa inválida. Usa formato tipo ABC123 (sin espacios).");
        return;
      }
    }

    mut.mutate(values);
  };

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space wrap align="start" size={12} style={{ width: "100%" }}>
          <Card title="Orden recomendado" style={{ width: 420 }}>
            <Steps
              direction="vertical"
              size="small"
              current={Math.min(currentStep, stepsItems.length - 1)}
              items={stepsItems}
            />
            <div style={{ marginTop: 10 }}>
              <Typography.Text strong>Estado actual:</Typography.Text>{" "}
              <Typography.Text>{props.estadoActual}</Typography.Text>
            </div>
          </Card>

          <Card title="Cambiar estado" style={{ flex: 1, minWidth: 380 }}>
            {props.locked ? (
              <Alert
                type="warning"
                showIcon
                message="Este trámite está bloqueado (Finalizado o Cancelado)."
                description="Para editar nuevamente debes usar Reabrir (si estaba finalizado)."
              />
            ) : null}

            {!props.locked && warning ? (
              <div style={{ marginBottom: 12 }}>
                <Alert type="warning" showIcon message={warning} />
              </div>
            ) : null}

            <Form
              form={form}
              layout="vertical"
              initialValues={{ toEstado: props.estadoActual }}
              disabled={props.locked || mut.isPending}
            >
              <Form.Item
                label="Nuevo estado"
                name="toEstado"
                rules={[{ required: true, message: "Selecciona un estado" }]}
              >
                <Select
                  options={ESTADOS_OPTIONS.map((e) => ({ value: e.value, label: e.label }))}
                  onChange={onEstadoChange}
                />
              </Form.Item>

              {/* ✅ SOLO aparece cuando el estado es PLACA_ASIGNADA */}
              {toEstadoWatch === "PLACA_ASIGNADA" ? (
                <Form.Item
                  label="Placa (obligatoria en este estado)"
                  name="placa"
                  rules={[{ required: true, message: "Ingresa la placa" }]}
                  normalize={(v) => (typeof v === "string" ? normalizePlaca(v) : v)}
                >
                  <Input placeholder="ABC123" maxLength={10} />
                </Form.Item>
              ) : null}

              <Form.Item label="Notas (opcional)" name="notes">
                <Input.TextArea rows={3} placeholder="Ej: Placa asignada por tránsito, pendiente envío físico" />
              </Form.Item>

              <Button type="primary" onClick={submit} loading={mut.isPending}>
                Guardar cambio
              </Button>
            </Form>
          </Card>
        </Space>

        <Card title="Historial de estados" loading={histQuery.isLoading}>
          <Table<EstadoHistItem>
            rowKey="id"
            columns={columns}
            dataSource={histQuery.data ?? []}
            pagination={false}
            scroll={{ x: 900 }}
          />
        </Card>
      </Space>
    </>
  );
}
