import {
  Alert,
  Button,
  Card,
  Descriptions,
  Progress,
  Space,
  Tag,
  Typography,
  message,
  Form,
  InputNumber,
  Divider,
} from "antd";
import { DownloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getTramiteById } from "../../../api/tramiteDetail";
import { getChecklist, getTramiteFiles } from "../../../api/tramiteDocumentos";
import { getPayments } from "../../../api/tramitePagos";
import { listShipmentsForTramite } from "../../../api/tramiteEnvios";

import { downloadCuentaCobroPdf } from "../../../api/cuentaCobro";
import { patchTramite } from "../../../api/tramiteUpdate";

function money(n: number) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

function normDocKey(x: any): string {
  return String(x?.docKey ?? x?.doc_key ?? x?.tipo ?? x?.key ?? "");
}

export default function ResumenTab(props: { tramiteId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<{ honorariosValor: number }>();

  // usa cache del mismo queryKey ["tramite", id]
  const tramiteQuery = useQuery({
    queryKey: ["tramite", props.tramiteId],
    queryFn: () => getTramiteById(props.tramiteId),
  });

  const checklistQuery = useQuery({
    queryKey: ["tramiteChecklist", props.tramiteId],
    queryFn: () => getChecklist(props.tramiteId),
  });

  const filesQuery = useQuery({
    queryKey: ["tramiteFiles", props.tramiteId],
    queryFn: () => getTramiteFiles(props.tramiteId),
  });

  const paymentsQuery = useQuery({
    queryKey: ["tramitePayments", props.tramiteId],
    queryFn: () => getPayments(props.tramiteId),
  });

  const shipmentsQuery = useQuery({
    queryKey: ["tramiteShipments", props.tramiteId],
    queryFn: () => listShipmentsForTramite(props.tramiteId),
  });

  const tramite = tramiteQuery.data;
  const checklist = checklistQuery.data ?? [];
  const files = filesQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];
  const shipments = shipmentsQuery.data ?? [];

  const totalPagos = useMemo(
    () => payments.reduce((acc, p: any) => acc + (Number(p.valor) || 0), 0),
    [payments]
  );
  const totalEnvios = useMemo(
    () => shipments.reduce((acc, s: any) => acc + (Number(s.costo) || 0), 0),
    [shipments]
  );
  const subtotalEmpresa = totalPagos + totalEnvios;

  // ✅ honorarios viene del backend (puede venir como honorariosValor o honorarios_valor)
  const honorariosBackend = useMemo(() => {
    const raw = (tramite as any)?.honorariosValor ?? (tramite as any)?.honorarios_valor ?? 0;
    const n = typeof raw === "string" ? Number(raw) : Number(raw ?? 0);
    return Number.isFinite(n) ? n : 0;
  }, [tramite]);

  const totalFinal = subtotalEmpresa + honorariosBackend;

  // ✅ sincroniza form con backend (cuando cargue/actualice)
  useEffect(() => {
    if (!tramite) return;
    form.setFieldsValue({ honorariosValor: honorariosBackend });
  }, [tramite, honorariosBackend, form]);

  const required = checklist.filter((c: any) => !!c.required);
  const done = checklist.filter((c: any) => c.status === "RECIBIDO");
  const doneRequired = required.filter((c: any) => c.status === "RECIBIDO");

  const pctAll = checklist.length ? Math.round((done.length / checklist.length) * 100) : 0;
  const pctReq = required.length ? Math.round((doneRequired.length / required.length) * 100) : 0;

  const facturaChecklist = checklist.find((c: any) => normDocKey(c) === "FACTURA");
  const facturaOkByChecklist = facturaChecklist?.status === "RECIBIDO";
  const facturaOkByFiles = files.some((f: any) => normDocKey(f) === "FACTURA");
  const facturaOk = facturaOkByChecklist || facturaOkByFiles;

  const hasMissingRequired = required.some((c: any) => c.status !== "RECIBIDO");

  // ✅ guardar honorarios
  const saveHonorMut = useMutation({
    mutationFn: async () => {
      const values = await form.validateFields();
      const val = Number(values.honorariosValor ?? 0);

      if (!Number.isFinite(val) || val < 0) {
        throw new Error("Honorarios inválidos");
      }

      await patchTramite(props.tramiteId, { honorariosValor: val });

      // refresca tramite para ver honorarios ya guardados
      await qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] });
      msgApi.success("Honorarios guardados");
      return true;
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo guardar honorarios"),
  });

  // ✅ descargar PDF (y auto-guardar si el usuario cambió honorarios sin guardar)
  const ccMut = useMutation({
    mutationFn: async () => {
      if (!tramite) throw new Error("NO_TRAMITE");

      // Si NO está locked, y el valor del form difiere del backend, lo guardamos primero
      if (!props.locked) {
        const current = Number(form.getFieldValue("honorariosValor") ?? 0);

        const a = Math.round(current);
        const b = Math.round(honorariosBackend);

        if (a !== b) {
          if (!Number.isFinite(current) || current < 0) throw new Error("Honorarios inválidos");
          await patchTramite(props.tramiteId, { honorariosValor: current });
          await qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] });
        }
      }

      // Ahora sí: PDF desde backend
      return downloadCuentaCobroPdf(props.tramiteId);
    },
    onSuccess: async (blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cuenta_cobro_${tramite?.display_id ?? props.tramiteId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      msgApi.success("Cuenta de cobro descargada");
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo generar la cuenta de cobro"),
  });

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {props.locked ? (
          <Alert type="warning" showIcon message="Trámite bloqueado" description="Está finalizado o cancelado. Solo lectura." />
        ) : null}

        {tramite?.is_atrasado ? (
          <Alert
            type="warning"
            showIcon
            message="Atrasado"
            description="Este trámite tiene reglas de atraso incumplidas (según el cálculo de alertas)."
          />
        ) : null}

        {!facturaOk ? (
          <Alert type="error" showIcon message="Falta factura" description="La factura es obligatoria. Sube la factura en Documentos." />
        ) : null}

        {hasMissingRequired ? (
          <Alert
            type="info"
            showIcon
            message="Documentos obligatorios pendientes"
            description="Aún faltan documentos marcados como obligatorios en el checklist."
          />
        ) : null}

        <Card title="Identificación">
          {tramite ? (
            <Descriptions column={3} size="small">
              <Descriptions.Item label="Trámite">{tramite.display_id}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag>{tramite.estado_actual}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Concesionario">{tramite.concesionario_code}</Descriptions.Item>

              <Descriptions.Item label="Ciudad">{tramite.ciudad_nombre ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Placa">{tramite.placa ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{tramite.cliente_nombre ?? "-"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text>Cargando…</Typography.Text>
          )}
        </Card>

        {/* ✅ Totales + honorarios */}
        <Card title="Totales (Cuenta de cobro)">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
              <Space direction="vertical" size={2}>
                <Typography.Text>Total pagos</Typography.Text>
                <Typography.Text strong>{money(totalPagos)}</Typography.Text>
              </Space>

              <Space direction="vertical" size={2}>
                <Typography.Text>Total envíos</Typography.Text>
                <Typography.Text strong>{money(totalEnvios)}</Typography.Text>
              </Space>

              <Space direction="vertical" size={2}>
                <Typography.Text>Subtotal empresa</Typography.Text>
                <Typography.Text strong>{money(subtotalEmpresa)}</Typography.Text>
              </Space>
            </Space>

            <Divider style={{ margin: "6px 0" }} />

            <Form form={form} layout="inline" disabled={props.locked} style={{ width: "100%" }}>
              <Form.Item
                label="Honorarios"
                name="honorariosValor"
                rules={[
                  { required: true, message: "Ingresa honorarios (puede ser 0)" },
                  {
                    validator: async (_, v) => {
                      const n = Number(v ?? 0);
                      if (!Number.isFinite(n)) throw new Error("Valor inválido");
                      if (n < 0) throw new Error("No puede ser negativo");
                    },
                  },
                ]}
              >
                <InputNumber<number>
                  min={0}
                  step={1000}
                  style={{ width: 220 }}
                  formatter={(value) => {
                    const n = Number(value ?? 0);
                    // miles con punto (simple)
                    return `$ ${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
                  }}
                  parser={(displayValue) => {
                    const digits = String(displayValue ?? "").replace(/[^\d]/g, "");
                    return digits ? Number(digits) : 0;
                  }}
                />
              </Form.Item>


              <Form.Item>
                <Button
                  icon={<SaveOutlined />}
                  onClick={() => saveHonorMut.mutate()}
                  loading={saveHonorMut.isPending}
                  disabled={props.locked || !tramite}
                >
                  Guardar honorarios
                </Button>
              </Form.Item>

              <Form.Item>
                <Button
                  icon={<DownloadOutlined />}
                  type="primary"
                  loading={ccMut.isPending}
                  disabled={!tramite}
                  onClick={() => ccMut.mutate()}
                >
                  Descargar cuenta de cobro (PDF)
                </Button>
              </Form.Item>
            </Form>

            <div>
              <Typography.Text>Total final (empresa + honorarios): </Typography.Text>
              <Typography.Text strong>{money(subtotalEmpresa + Number(form.getFieldValue("honorariosValor") ?? honorariosBackend))}</Typography.Text>
            </div>
          </Space>
        </Card>

        <Card title="Progreso del checklist">
          <Space direction="vertical" size={10} style={{ width: "100%" }}>
            <div>
              <Typography.Text>Checklist general</Typography.Text>
              <Progress percent={pctAll} />
              <Typography.Text type="secondary">
                {done.length} / {checklist.length} recibidos
              </Typography.Text>
            </div>

            <div>
              <Typography.Text>Obligatorios</Typography.Text>
              <Progress percent={pctReq} />
              <Typography.Text type="secondary">
                {doneRequired.length} / {required.length} obligatorios recibidos
              </Typography.Text>
            </div>
          </Space>
        </Card>
      </Space>
    </>
  );
}
