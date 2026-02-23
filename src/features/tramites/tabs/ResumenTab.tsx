import {
  Alert,
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Progress,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { DownloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getTramiteById } from "../../../api/tramiteDetail";
import { getChecklist, getTramiteFiles } from "../../../api/tramiteDocumentos";
import { downloadCuentaCobroPdf } from "../../../api/cuentaCobro";
import {
  getCuentaCobroResumen,
  saveCuentaCobroHonorarios,
  saveCuentaCobroPagos,
  type CuentaCobroConcepto,
} from "../../../api/tramiteCuentaCobro";
import { buildCuentaCobroRowTemplates, matchCuentaCobroRowKey } from "../../../utils/cuentaCobroRows";

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

type CuentaCobroFormValues = {
  honorariosValor?: number;
  conceptos?: Record<string, { anio?: string; total?: number; valor4x1000?: number; observacion?: string }>;
};

function safeNumber(raw: unknown): number {
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function buildConceptosFormValues(conceptos: CuentaCobroConcepto[] | undefined) {
  const out: Record<string, { anio: string; total: number; valor4x1000: number; observacion: string }> = {};
  for (const c of conceptos ?? []) {
    out[c.id] = {
      anio: String(c.anio ?? ""),
      total: safeNumber(c.total),
      valor4x1000: c.has4x1000 ? safeNumber(c.valor4x1000) : 0,
      observacion: String(c.observacion ?? ""),
    };
  }
  return out;
}

function buildFixedTramiteConceptos(incoming: CuentaCobroConcepto[] | undefined, serviceLabel: string): CuentaCobroConcepto[] {
  const templates = buildCuentaCobroRowTemplates(serviceLabel);
  const usedKeys = new Set<any>();
  const byKey = new Map<string, CuentaCobroConcepto>();

  for (const c of incoming ?? []) {
    const key =
      matchCuentaCobroRowKey(c.id, { serviceLabel, usedKeys }) ??
      matchCuentaCobroRowKey(c.nombre, { serviceLabel, usedKeys });
    if (key && !byKey.has(key)) byKey.set(key, c);
  }

  return templates.map((t) => {
    const src = byKey.get(t.id);
    return {
      id: t.id,
      nombre: t.nombre,
      anio: src?.anio,
      has4x1000: t.has4x1000,
      total: safeNumber(src?.total),
      valor4x1000: t.has4x1000 ? safeNumber(src?.valor4x1000) : 0,
      observacion: src?.observacion,
    };
  });
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

  // Delay revoke so preview tabs can finish loading the blob URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function getHonorariosFromTramite(tramite: any): number {
  const raw = tramite?.honorariosValor ?? tramite?.honorarios_valor ?? 0;
  return safeNumber(raw);
}

export default function ResumenTab(props: { tramiteId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<CuentaCobroFormValues>();

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

  const cuentaCobroQuery = useQuery({
    queryKey: ["tramiteCuentaCobro", props.tramiteId],
    queryFn: () => getCuentaCobroResumen(props.tramiteId),
  });

  const tramite = tramiteQuery.data;
  const checklist = checklistQuery.data ?? [];
  const files = filesQuery.data ?? [];
  const cuentaCobro = cuentaCobroQuery.data;
  const servicioNombre = String(
    (tramite as any)?.servicio_nombre ??
      (tramite as any)?.servicioNombre ??
      (tramite as any)?.service_name ??
      (tramite as any)?.serviceName ??
      "Traspaso"
  );
  const fechaCuentaCobro = String((tramite as any)?.fecha ?? (tramite as any)?.created_at ?? "").slice(0, 10) || "-";
  const conceptos = useMemo(
    () => buildFixedTramiteConceptos(cuentaCobro?.conceptos, servicioNombre),
    [cuentaCobro?.conceptos, servicioNombre]
  );

  // Prefer backend cuenta-cobro response; fallback keeps current behavior during migration.
  const honorariosBackend = useMemo(() => {
    if (cuentaCobro) return safeNumber(cuentaCobro.honorarios);
    return getHonorariosFromTramite(tramite);
  }, [cuentaCobro, tramite]);

  useEffect(() => {
    if (cuentaCobroQuery.isLoading) return;
    if (!cuentaCobro && !tramite) return;

    form.setFieldsValue({
      honorariosValor: honorariosBackend,
      conceptos: buildConceptosFormValues(conceptos),
    });
  }, [cuentaCobroQuery.isLoading, cuentaCobro, honorariosBackend, tramite, form, conceptos]);

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

  const savePagosMut = useMutation({
    mutationFn: async () => {
      if (!conceptos.length) throw new Error("No hay conceptos para guardar");

      const fieldNames = conceptos.flatMap((c) => {
        const names: any[] = [["conceptos", c.id, "total"]];
        if (c.has4x1000) names.push(["conceptos", c.id, "valor4x1000"]);
        return names;
      });

      await form.validateFields(fieldNames);

      const conceptosForm = (form.getFieldValue("conceptos") ?? {}) as CuentaCobroFormValues["conceptos"];

      const payload = {
        conceptos: conceptos.map((c) => {
          const anio = String(conceptosForm?.[c.id]?.anio ?? "").trim();
          const rawTotal = safeNumber(conceptosForm?.[c.id]?.total);
          const raw4x1000 = c.has4x1000 ? safeNumber(conceptosForm?.[c.id]?.valor4x1000) : 0;
          const observacion = String(conceptosForm?.[c.id]?.observacion ?? "").trim();

          if (rawTotal < 0 || raw4x1000 < 0) {
            throw new Error(`Valores invalidos en ${c.nombre}`);
          }
          if (c.has4x1000 && raw4x1000 > rawTotal) {
            throw new Error(`4x1000 no puede ser mayor que Total en ${c.nombre}`);
          }

          return {
            conceptoId: c.id,
            nombre: c.nombre,
            anio: anio || undefined,
            total: rawTotal,
            valor4x1000: raw4x1000,
            observacion: observacion || undefined,
          };
        }),
      };

      return saveCuentaCobroPagos(props.tramiteId, payload);
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["tramiteCuentaCobro", props.tramiteId] });
      msgApi.success("Pagos por concepto guardados");
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo guardar pagos"),
  });

  const saveHonorMut = useMutation({
    mutationFn: async () => {
      await form.validateFields([["honorariosValor"]]);
      const val = safeNumber(form.getFieldValue("honorariosValor"));

      if (val < 0) throw new Error("Honorarios invalidos");

      await saveCuentaCobroHonorarios(props.tramiteId, val);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["tramiteCuentaCobro", props.tramiteId] }),
        qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] }),
      ]);
      msgApi.success("Honorarios guardados");
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo guardar honorarios"),
  });

  const ccMut = useMutation({
    mutationFn: async () => {
      if (!tramite) throw new Error("NO_TRAMITE");

      if (!props.locked) {
        await form.validateFields([["honorariosValor"]]);
        const current = safeNumber(form.getFieldValue("honorariosValor"));
        if (Math.round(current) !== Math.round(honorariosBackend)) {
          await saveCuentaCobroHonorarios(props.tramiteId, current);
          await Promise.all([
            qc.invalidateQueries({ queryKey: ["tramiteCuentaCobro", props.tramiteId] }),
            qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] }),
          ]);
        }
      }

      return downloadCuentaCobroPdf(props.tramiteId);
    },
    onSuccess: (blob) => {
      const filename = `cuenta_cobro_${tramite?.display_id ?? props.tramiteId}.pdf`;
      openOrDownloadBlob(blob, filename);
      msgApi.success("Cuenta de cobro lista");
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? e?.message ?? "No se pudo generar la cuenta de cobro"),
  });

  const totales = cuentaCobro?.totales;

  return (
    <>
      {ctx}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        {props.locked ? (
          <Alert type="warning" showIcon message="Tramite bloqueado" description="Esta finalizado o cancelado. Solo lectura." />
        ) : null}

        {tramite?.is_atrasado ? (
          <Alert
            type="warning"
            showIcon
            message="Atrasado"
            description="Este tramite tiene reglas de atraso incumplidas (segun el calculo de alertas)."
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
            description="Aun faltan documentos marcados como obligatorios en el checklist."
          />
        ) : null}

        <Card title="Identificacion">
          {tramite ? (
            <Descriptions column={3} size="small">
              <Descriptions.Item label="Tramite">{tramite.display_id}</Descriptions.Item>
              <Descriptions.Item label="Estado">
                <Tag>{tramite.estado_actual}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Concesionario">{tramite.concesionario_code}</Descriptions.Item>

              <Descriptions.Item label="Ciudad">{tramite.ciudad_nombre ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Placa">{tramite.placa ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{tramite.cliente_nombre ?? "-"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text>Cargando...</Typography.Text>
          )}
        </Card>

        <Card title="Cuenta de cobro" loading={cuentaCobroQuery.isLoading}>
          <Space direction="vertical" size={14} style={{ width: "100%" }}>
            <Typography.Text type="secondary">
              Los conceptos y totales se cargan desde backend. El frontend solo captura y muestra resultados.
            </Typography.Text>

            {cuentaCobroQuery.isError ? (
              <Alert
                type="error"
                showIcon
                message="No se pudo cargar la cuenta de cobro"
                description="Verifica conectividad con backend y los endpoints de conceptos/totales."
              />
            ) : null}

            <Form<CuentaCobroFormValues>
              form={form}
              layout="vertical"
              disabled={props.locked || savePagosMut.isPending || saveHonorMut.isPending}
            >
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Card size="small" title="Datos base (cabecera PDF)">
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="Servicio">{servicioNombre}</Descriptions.Item>
                    <Descriptions.Item label="Fecha">{fechaCuentaCobro}</Descriptions.Item>
                    <Descriptions.Item label="Cliente">{tramite?.cliente_nombre ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="NIT o C.C.">{tramite?.cliente_doc ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="Placas">{tramite?.placa ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="Ciudad">{tramite?.ciudad_nombre ?? "-"}</Descriptions.Item>
                    <Descriptions.Item label="Concesionario">{tramite?.concesionario_code ?? "-"}</Descriptions.Item>
                  </Descriptions>
                </Card>

                <Typography.Text strong>Pagos por concepto</Typography.Text>

                {conceptos.map((concepto) => (
                  <Card key={concepto.id} size="small" title={concepto.nombre}>
                    <Space wrap align="start">
                      <Form.Item label="Ano" name={["conceptos", concepto.id, "anio"]}>
                        <Input style={{ width: 140 }} placeholder="Ej: 2026" />
                      </Form.Item>

                      <Form.Item
                        label="Valor total"
                        name={["conceptos", concepto.id, "total"]}
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

                      {concepto.has4x1000 ? (
                        <Form.Item
                          label="4x1000"
                          name={["conceptos", concepto.id, "valor4x1000"]}
                          dependencies={[["conceptos", concepto.id, "total"]]}
                          rules={[
                            {
                              validator: async (_, v) => {
                                const n = safeNumber(v);
                                if (n < 0) throw new Error("No puede ser negativo");

                                const total = safeNumber(form.getFieldValue(["conceptos", concepto.id, "total"]));
                                if (n > total) throw new Error("4x1000 no puede ser mayor que Total");
                              },
                            },
                          ]}
                        >
                          <InputNumber min={0} step={1000} style={{ width: 220 }} />
                        </Form.Item>
                      ) : null}

                      <Form.Item label="Observacion" name={["conceptos", concepto.id, "observacion"]} style={{ minWidth: 280 }}>
                        <Input placeholder="Opcional" />
                      </Form.Item>
                    </Space>
                  </Card>
                ))}

                <Space wrap>
                  <Button
                    icon={<SaveOutlined />}
                    onClick={() => savePagosMut.mutate()}
                    loading={savePagosMut.isPending}
                    disabled={props.locked || !conceptos.length}
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
                    <InputNumber<number> min={0} step={1000} style={{ width: 220 }} />
                  </Form.Item>

                  <Form.Item label=" ">
                    <Button
                      icon={<SaveOutlined />}
                      onClick={() => saveHonorMut.mutate()}
                      loading={saveHonorMut.isPending}
                      disabled={props.locked || !tramite}
                    >
                      Guardar honorarios
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
                  <Typography.Text>SALDO PDTE POR CANCELAR CUENTA</Typography.Text>
                  <Typography.Text strong>{money(safeNumber(totales?.saldoPdtePorCancelar))}</Typography.Text>
                </Space>
              </Space>
            </Card>

            <Space wrap>
              <Button
                icon={<DownloadOutlined />}
                type="primary"
                loading={ccMut.isPending}
                disabled={!tramite}
                onClick={() => ccMut.mutate()}
              >
                Cuenta de Cobro (PDF)
              </Button>
            </Space>
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

