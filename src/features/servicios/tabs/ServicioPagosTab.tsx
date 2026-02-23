import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Space,
  Typography,
  message,
} from "antd";
import { DownloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { ServicioDetail } from "../../../api/servicios";
import {
  downloadServicioCuentaCobroPdf,
  getServicioCuentaCobroResumen,
  saveServicioCuentaCobroHonorarios,
  saveServicioCuentaCobroPagos,
  type ServicioCuentaCobroPago,
} from "../../../api/servicioCuentaCobro";
import { buildCuentaCobroRowTemplates, matchCuentaCobroRowKey } from "../../../utils/cuentaCobroRows";

function money(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
}

function safeNumber(raw: unknown) {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function openOrDownloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const popup = window.open(url, "_blank", "noopener,noreferrer");

  if (!popup) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

type FormRowValue = {
  anio?: string;
  valor_total?: number;
  valor_4x1000?: number;
  observacion?: string;
};

type CuentaCobroServicioFormValues = {
  honorariosValor?: number;
  pagos?: Record<string, FormRowValue>;
};

type FixedServicioRow = {
  id: string;
  nombre: string;
  has4x1000: boolean;
  anio?: string;
  valorTotal: number;
  valor4x1000: number;
  observacion?: string;
};

function buildFixedServicioRows(incoming: ServicioCuentaCobroPago[] | undefined, serviceLabel: string): FixedServicioRow[] {
  const templates = buildCuentaCobroRowTemplates(serviceLabel);
  const usedKeys = new Set<any>();
  const byKey = new Map<string, ServicioCuentaCobroPago>();

  for (const p of incoming ?? []) {
    const key =
      matchCuentaCobroRowKey(p.id, { serviceLabel, usedKeys }) ??
      matchCuentaCobroRowKey(p.concepto, { serviceLabel, usedKeys });
    if (key && !byKey.has(key)) byKey.set(key, p);
  }

  return templates.map((t) => {
    const src = byKey.get(t.id);
    return {
      id: t.id,
      nombre: t.nombre,
      has4x1000: t.has4x1000,
      anio: src?.anio,
      valorTotal: safeNumber(src?.valorTotal),
      valor4x1000: t.has4x1000 ? safeNumber(src?.valor4x1000) : 0,
      observacion: src?.observacion,
    };
  });
}

function buildPagosFormValues(rows: FixedServicioRow[]): Record<string, FormRowValue> {
  const out: Record<string, FormRowValue> = {};
  for (const r of rows) {
    out[r.id] = {
      anio: String(r.anio ?? ""),
      valor_total: safeNumber(r.valorTotal),
      valor_4x1000: r.has4x1000 ? safeNumber(r.valor4x1000) : 0,
      observacion: String(r.observacion ?? ""),
    };
  }
  return out;
}

export default function ServicioPagosTab(props: {
  servicioId: string;
  locked: boolean;
  servicio?: ServicioDetail;
  servicioLabel?: string;
}) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<CuentaCobroServicioFormValues>();

  const cuentaCobroQuery = useQuery({
    queryKey: ["servicioCuentaCobro", props.servicioId],
    queryFn: () => getServicioCuentaCobroResumen(props.servicioId),
    retry: false,
  });

  const base = cuentaCobroQuery.data?.baseData;
  const servicioNombre = (base?.servicio && base.servicio !== "-" ? base.servicio : props.servicioLabel) ?? "-";
  const fixedRows = useMemo(
    () => buildFixedServicioRows(cuentaCobroQuery.data?.pagos, servicioNombre),
    [cuentaCobroQuery.data?.pagos, servicioNombre]
  );

  useEffect(() => {
    if (cuentaCobroQuery.isLoading) return;
    form.setFieldsValue({
      honorariosValor: safeNumber(cuentaCobroQuery.data?.honorarios),
      pagos: buildPagosFormValues(fixedRows),
    });
  }, [cuentaCobroQuery.isLoading, cuentaCobroQuery.data?.honorarios, fixedRows, form]);

  const savePagosMut = useMutation({
    mutationFn: async () => {
      const fieldNames = fixedRows.flatMap((r) => {
        const fields: any[] = [["pagos", r.id, "valor_total"], ["pagos", r.id, "anio"], ["pagos", r.id, "observacion"]];
        if (r.has4x1000) fields.push(["pagos", r.id, "valor_4x1000"]);
        return fields;
      });
      await form.validateFields(fieldNames);

      const pagosForm = (form.getFieldValue("pagos") ?? {}) as CuentaCobroServicioFormValues["pagos"];

      return saveServicioCuentaCobroPagos(props.servicioId, {
        pagos: fixedRows.map((r) => ({
          conceptoId: r.id,
          concepto: r.nombre,
          anio: String(pagosForm?.[r.id]?.anio ?? "").trim() || undefined,
          valorTotal: Math.max(0, safeNumber(pagosForm?.[r.id]?.valor_total)),
          valor4x1000: r.has4x1000 ? Math.max(0, safeNumber(pagosForm?.[r.id]?.valor_4x1000)) : 0,
          observacion: String(pagosForm?.[r.id]?.observacion ?? "").trim() || undefined,
        })),
      });
    },
    onSuccess: async () => {
      msgApi.success("Pagos guardados");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["servicioCuentaCobro", props.servicioId] }),
        qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] }),
      ]);
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudieron guardar pagos"),
  });

  const saveHonorMut = useMutation({
    mutationFn: async () => {
      await form.validateFields([["honorariosValor"]]);
      const val = Math.max(0, safeNumber(form.getFieldValue("honorariosValor")));
      return saveServicioCuentaCobroHonorarios(props.servicioId, val);
    },
    onSuccess: async () => {
      msgApi.success("Honorarios guardados");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["servicioCuentaCobro", props.servicioId] }),
        qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] }),
      ]);
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo guardar honorarios"),
  });

  const pdfMut = useMutation({
    mutationFn: async () => {
      if (!props.locked) {
        const formVal = Math.max(0, safeNumber(form.getFieldValue("honorariosValor")));
        const backendVal = Math.max(0, safeNumber(cuentaCobroQuery.data?.honorarios));
        if (Math.round(formVal) !== Math.round(backendVal)) {
          await saveServicioCuentaCobroHonorarios(props.servicioId, formVal);
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["servicioCuentaCobro", props.servicioId] }),
            qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] }),
          ]);
        }
      }

      return downloadServicioCuentaCobroPdf(props.servicioId);
    },
    onSuccess: (blob) => {
      const filename = `cuenta_cobro_servicio_${props.servicio?.display_id ?? props.servicioId}.pdf`;
      openOrDownloadBlob(blob, filename);
      msgApi.success("Cuenta de cobro lista");
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo generar el PDF"),
  });

  const totales = cuentaCobroQuery.data?.totales;
  const fechaBase = base?.fecha ?? (String((props.servicio as any)?.created_at ?? "").slice(0, 10) || "-");

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {props.locked ? (
          <Alert type="warning" showIcon message="Pagos bloqueados" description="Servicio ENTREGADO/CANCELADO. Solo ver." />
        ) : null}

        <Card title="Datos base (cabecera PDF)">
          <Descriptions column={2} size="small">
            <Descriptions.Item label="Servicio">{servicioNombre}</Descriptions.Item>
            <Descriptions.Item label="Fecha">{fechaBase}</Descriptions.Item>
            <Descriptions.Item label="Cliente">{base?.cliente ?? props.servicio?.cliente_nombre ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="NIT o C.C.">{base?.clienteDoc ?? props.servicio?.cliente_doc ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Placas">{base?.placas ?? (props.servicio as any)?.placa ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Ciudad">{base?.ciudad ?? props.servicio?.ciudad_nombre ?? "-"}</Descriptions.Item>
            <Descriptions.Item label="Concesionario">{base?.concesionario ?? props.servicio?.concesionario_code ?? "-"}</Descriptions.Item>
          </Descriptions>
        </Card>

        <Card title="Cuenta de cobro" loading={cuentaCobroQuery.isLoading}>
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            {cuentaCobroQuery.isError ? (
              <Alert
                type="warning"
                showIcon
                message="Cuenta de cobro de servicios no disponible en backend"
                description="Se esta usando fallback local mientras el backend implementa estos endpoints."
              />
            ) : null}

            <Form
              form={form}
              layout="vertical"
              disabled={props.locked || savePagosMut.isPending || saveHonorMut.isPending}
            >
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Typography.Text strong>Pagos por concepto (fijos)</Typography.Text>

                {fixedRows.map((row) => (
                  <Card key={row.id} size="small" title={row.nombre}>
                    <Space wrap align="start">
                      <Form.Item label="Año" name={["pagos", row.id, "anio"]}>
                        <Input style={{ width: 140 }} placeholder="Ej: 2026" />
                      </Form.Item>

                      <Form.Item
                        label="Valor total"
                        name={["pagos", row.id, "valor_total"]}
                        rules={[
                          {
                            validator: async (_, v) => {
                              const n = safeNumber(v);
                              if (n < 0) throw new Error("No puede ser negativo");
                            },
                          },
                        ]}
                      >
                        <InputNumber min={0} step={1000} style={{ width: 220 }} />
                      </Form.Item>

                      {row.has4x1000 ? (
                        <Form.Item
                          label="4x1000"
                          name={["pagos", row.id, "valor_4x1000"]}
                          rules={[
                            {
                              validator: async (_, v) => {
                                const n = safeNumber(v);
                                if (n < 0) throw new Error("No puede ser negativo");
                              },
                            },
                          ]}
                        >
                          <InputNumber min={0} step={1000} style={{ width: 220 }} />
                        </Form.Item>
                      ) : null}

                      <Form.Item label="Observacion" name={["pagos", row.id, "observacion"]} style={{ minWidth: 280 }}>
                        <Input placeholder="Opcional" />
                      </Form.Item>

                      {row.has4x1000 ? (
                        <Form.Item noStyle shouldUpdate>
                          {() => {
                            const total = safeNumber(form.getFieldValue(["pagos", row.id, "valor_total"]));
                            const v4 = safeNumber(form.getFieldValue(["pagos", row.id, "valor_4x1000"]));
                            return v4 > total ? (
                              <Typography.Text type="warning">
                                Advertencia: 4x1000 mayor que valor total (se permite guardar).
                              </Typography.Text>
                            ) : null;
                          }}
                        </Form.Item>
                      ) : null}
                    </Space>
                  </Card>
                ))}

                <Space wrap>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={() => savePagosMut.mutate()}
                    loading={savePagosMut.isPending}
                    disabled={props.locked}
                  >
                    Guardar pagos
                  </Button>
                </Space>

                <Typography.Text strong>Honorarios</Typography.Text>

                <Space wrap align="start">
                  <Form.Item
                    label="Honorarios"
                    name="honorariosValor"
                    rules={[
                      {
                        validator: async (_, v) => {
                          const n = safeNumber(v);
                          if (n < 0) throw new Error("No puede ser negativo");
                        },
                      },
                    ]}
                  >
                    <InputNumber min={0} step={1000} style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item label=" ">
                    <Button
                      icon={<SaveOutlined />}
                      onClick={() => saveHonorMut.mutate()}
                      loading={saveHonorMut.isPending}
                      disabled={props.locked}
                    >
                      Guardar honorarios
                    </Button>
                  </Form.Item>

                  <Form.Item label=" ">
                    <Button
                      icon={<DownloadOutlined />}
                      type="primary"
                      onClick={() => pdfMut.mutate()}
                      loading={pdfMut.isPending}
                    >
                      Generar / Ver Cuenta de Cobro (PDF)
                    </Button>
                  </Form.Item>
                </Space>
              </Space>
            </Form>

            <Card size="small" title="Totales (calculados por backend)">
              <Space direction="vertical" size={8} style={{ width: "100%" }}>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Typography.Text>TOTAL A REEMBOLSAR</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.totalAReembolsar))}</Typography.Text>
                </Space>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Typography.Text>MAS TOTAL CUENTA DE COBRO</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.masTotalCuentaDeCobro))}</Typography.Text>
                </Space>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Typography.Text>TOTAL A CANCELAR</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.totalACancelar))}</Typography.Text>
                </Space>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Typography.Text>MENOS ABONO</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.menosAbono))}</Typography.Text>
                </Space>
                <Space style={{ justifyContent: "space-between", width: "100%" }}>
                  <Typography.Text>SALDO PDTE POR CANCELAR</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.saldoPdtePorCancelar))}</Typography.Text>
                </Space>
              </Space>
            </Card>
          </Space>
        </Card>
      </Space>
    </>
  );
}
