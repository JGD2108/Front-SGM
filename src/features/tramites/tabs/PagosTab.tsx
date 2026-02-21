import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tabs, Tag, Typography, Upload, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import { UploadOutlined, DownloadOutlined, DeleteOutlined } from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { createPayment, deletePayment, getPayments } from "../../../api/tramitePagos";
import type { PaymentRecord, PaymentType } from "../../../api/mockPaymentsState";
import { downloadFile } from "../../../api/tramiteDocumentos";

const TYPE_LABEL: Record<PaymentType, string> = {
  TIMBRE: "Timbre",
  DERECHOS: "Derechos",
  OTRO: "Otro",
};

function money(n: number) {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
}

export default function PagosTab(props: { tramiteId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();

  const paymentsQuery = useQuery({
    queryKey: ["tramitePayments", props.tramiteId],
    queryFn: () => getPayments(props.tramiteId),
  });

  const all = paymentsQuery.data ?? [];
  const total = useMemo(() => all.reduce((acc, p) => acc + (Number(p.valor) || 0), 0), [all]);

  const byType = useMemo(() => {
    const map: Record<PaymentType, PaymentRecord[]> = { TIMBRE: [], DERECHOS: [], OTRO: [] };
    for (const p of all) map[p.type]?.push(p);
    return map;
  }, [all]);

  const createMut = useMutation({
    mutationFn: (payload: any) => createPayment(props.tramiteId, payload),
    onSuccess: (created: PaymentRecord) => {
      msgApi.success("Pago registrado");
      qc.setQueryData<PaymentRecord[]>(["tramitePayments", props.tramiteId], (prev) => {
        const current = Array.isArray(prev) ? prev : [];
        if (current.some((p) => p.id === created.id)) return current;
        return [created, ...current];
      });
      qc.invalidateQueries({ queryKey: ["tramitePayments", props.tramiteId], refetchType: "active" });
      qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] });
    },
    onError: (err: any) => msgApi.error(err?.response?.data?.message ?? "No se pudo registrar el pago"),
  });

  const delMut = useMutation({
    mutationFn: (paymentId: string) => deletePayment(props.tramiteId, paymentId),
    onSuccess: (_, paymentId) => {
      msgApi.success("Pago eliminado");
      qc.setQueryData<PaymentRecord[]>(["tramitePayments", props.tramiteId], (prev) =>
        (prev ?? []).filter((p) => p.id !== paymentId)
      );
      qc.invalidateQueries({ queryKey: ["tramitePayments", props.tramiteId], refetchType: "active" });
      qc.invalidateQueries({ queryKey: ["tramite", props.tramiteId] });
    },
    onError: () => msgApi.error("No se pudo eliminar"),
  });

  const downloadAttachment = async (p: PaymentRecord) => {
    try {
      if (!p.attachment_file_id) return;
      const blob = await downloadFile(p.attachment_file_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = p.attachment_name || `pago_${p.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      msgApi.error("No se pudo descargar adjunto");
    }
  };

  const columns = (type: PaymentType): ColumnsType<PaymentRecord> => [
    { title: "Fecha", dataIndex: "fecha", key: "fecha", width: 120 },
    {
      title: "Valor",
      dataIndex: "valor",
      key: "valor",
      width: 160,
      render: (v: number) => <Typography.Text strong>{money(Number(v) || 0)}</Typography.Text>,
    },
    { title: "Medio", dataIndex: "medio_pago", key: "medio_pago", width: 140, render: (v) => v ?? "—" },
    { title: "Cuenta", dataIndex: "cuenta", key: "cuenta", width: 140, render: (v) => v ?? "—" },
    { title: "Notas", dataIndex: "notes", key: "notes", render: (v) => v ?? "—" },
    {
      title: "Adjunto",
      key: "att",
      width: 140,
      render: (_, p) =>
        p.attachment_file_id ? (
          <Button icon={<DownloadOutlined />} onClick={() => downloadAttachment(p)}>
            Descargar
          </Button>
        ) : (
          <Tag>—</Tag>
        ),
    },
    {
      title: "Acciones",
      key: "act",
      width: 120,
      render: (_, p) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          disabled={props.locked}
          loading={delMut.isPending}
          onClick={() => delMut.mutate(p.id)}
        >
          Eliminar
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
            message="Pagos bloqueados"
            description="El trámite está finalizado o cancelado. Solo puedes ver."
          />
        ) : (
          <Alert type="info" showIcon message="Pagos" description="Registra timbre, derechos y otros costos." />
        )}

        <Card>
          <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
            <Typography.Text>
              Total pagos: <Typography.Text strong>{money(total)}</Typography.Text>
            </Typography.Text>
            <Tag>Se sumará con envíos para total empresa</Tag>
          </Space>
        </Card>

        <Tabs
          items={[
            {
              key: "TIMBRE",
              label: "Timbre",
              children: <PaymentsSection type="TIMBRE" locked={props.locked} data={byType.TIMBRE} onCreate={createMut} columns={columns("TIMBRE")} />,
            },
            {
              key: "DERECHOS",
              label: "Derechos",
              children: <PaymentsSection type="DERECHOS" locked={props.locked} data={byType.DERECHOS} onCreate={createMut} columns={columns("DERECHOS")} />,
            },
            {
              key: "OTRO",
              label: "Otros",
              children: <PaymentsSection type="OTRO" locked={props.locked} data={byType.OTRO} onCreate={createMut} columns={columns("OTRO")} />,
            },
          ]}
        />
      </Space>
    </>
  );
}

function PaymentsSection(props: {
  type: PaymentType;
  locked: boolean;
  data: PaymentRecord[];
  onCreate: any;
  columns: ColumnsType<PaymentRecord>;
}) {
  const [form] = Form.useForm();
  const [file, setFile] = useState<File | null>(null);

  const submit = async () => {
    const v = await form.validateFields();
    props.onCreate.mutate({
      type: props.type,
      valor: Number(v.valor),
      fecha: v.fecha,
      medio_pago: v.medio_pago,
      notes: v.notes,
      attachment: file,
    });
    form.resetFields();
    setFile(null);
  };

  const uploadDummy = (opt: UploadRequestOption) => {
    setFile(opt.file as File);
    opt.onSuccess?.({}, opt.file as any);
  };

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Card title={`Registrar ${TYPE_LABEL[props.type]}`} size="small">
        <Form form={form} layout="vertical" disabled={props.locked || props.onCreate.isPending}>
          <Space wrap style={{ width: "100%" }} align="start">
            <Form.Item
              label="Valor (COP)"
              name="valor"
              rules={[{ required: true, message: "Ingresa el valor" }]}
            >
              <InputNumber min={0} style={{ width: 220 }} />
            </Form.Item>

            <Form.Item
              label="Fecha"
              name="fecha"
              rules={[{ required: true, message: "Selecciona la fecha" }]}
              initialValue={dayjs().format("YYYY-MM-DD")}
            >
              <Input placeholder="YYYY-MM-DD" style={{ width: 180 }} />
            </Form.Item>

            <Form.Item
              label="Medio de pago"
              name="medio_pago"
              rules={[{ required: true, message: "Selecciona el medio de pago" }]}
            >
              <Select
                style={{ width: 200 }}
                options={[
                  { value: "EFECTIVO", label: "Efectivo" },
                  { value: "TRANSFERENCIA", label: "Transferencia" },
                  { value: "TARJETA", label: "Tarjeta" },
                  { value: "PSE", label: "PSE" },
                  { value: "OTRO", label: "Otro" },
                ]}
              />
            </Form.Item>
          </Space>

          <Form.Item label="Notas" name="notes">
            <Input.TextArea rows={2} placeholder="Opcional" />
          </Form.Item>

          <Space wrap>
            <Upload
              accept=".pdf,application/pdf"
              maxCount={1}
              customRequest={uploadDummy}
              showUploadList={true}
              disabled={props.locked}
            >
              <Button icon={<UploadOutlined />} disabled={props.locked}>
                Adjuntar PDF (opcional)
              </Button>
            </Upload>

            <Button type="primary" onClick={submit} disabled={props.locked} loading={props.onCreate.isPending}>
              Guardar
            </Button>

            {file ? <Tag color="blue">{file.name}</Tag> : <Tag>Sin adjunto</Tag>}
          </Space>
        </Form>
      </Card>

      <Card title="Historial" size="small">
        <Table<PaymentRecord>
          rowKey="id"
          columns={props.columns}
          dataSource={props.data}
          pagination={false}
          scroll={{ x: 1100 }}
        />
      </Card>
    </Space>
  );
}
