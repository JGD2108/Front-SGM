// src/features/servicios/tabs/ServicioPagosTab.tsx
import { Alert, Button, Card, Form, Input, InputNumber, Modal, Space, Table, Typography, message } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import { addServicioPago, listServicioPagos } from "../../../api/servicios";

function money(n: number) {
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);
}

export default function ServicioPagosTab(props: { servicioId: string; locked: boolean }) {
    const qc = useQueryClient();
    const [msgApi, ctx] = message.useMessage();
    const [open, setOpen] = useState(false);
    const [form] = Form.useForm();

    const pagosQuery = useQuery({
        queryKey: ["servicioPagos", props.servicioId],
        queryFn: () => listServicioPagos(props.servicioId),
    });

    const total = useMemo(
        () => (pagosQuery.data?.items ?? []).reduce((acc: number, p: any) => acc + (Number(p.valor) || 0), 0),
        [pagosQuery.data?.items]
    );

    const mut = useMutation({
        mutationFn: (v: any) => addServicioPago(props.servicioId, { concepto: v.concepto, valor: Number(v.valor) }),
        onSuccess: () => {
            msgApi.success("Pago agregado");
            setOpen(false);
            form.resetFields();
            qc.invalidateQueries({ queryKey: ["servicioPagos", props.servicioId] });
            qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] });
        },
        onError: (e: any) => msgApi.error(e?.response?.data?.message ?? "No se pudo agregar pago"),
    });

    const cols: ColumnsType<any> = [
        { title: "Concepto", dataIndex: "concepto", key: "concepto" },
        { title: "Valor", dataIndex: "valor", key: "valor", width: 180, render: (v) => <Typography.Text strong>{money(Number(v) || 0)}</Typography.Text> },
        { title: "Fecha", dataIndex: "created_at", key: "created_at", width: 180, render: (iso) => (iso ? dayjs(iso).format("YYYY-MM-DD HH:mm") : "—") },
    ];

    return (
        <>
            {ctx}

            {props.locked ? (
                <Alert type="warning" showIcon message="Pagos bloqueados" description="Servicio ENTREGADO/CANCELADO. Solo ver." />
            ) : null}

            <Card>
                <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
                    <Typography.Text>
                        Total pagos: <Typography.Text strong>{money(total)}</Typography.Text>
                    </Typography.Text>

                    <Button type="primary" disabled={props.locked} onClick={() => setOpen(true)}>
                        Agregar pago
                    </Button>
                </Space>
            </Card>

            <Card title="Pagos" loading={pagosQuery.isLoading}>
                <Table
                    rowKey={(r) =>
                        `${r.changed_at}-${r.changed_by}-${r.to_estado_servicio}-${String(r.from_estado_servicio ?? "NA")}`
                    }
                />

            </Card>

            <Modal
                title="Agregar pago"
                open={open}
                onCancel={() => setOpen(false)}
                okText="Guardar"
                okButtonProps={{ loading: mut.isPending }}
                onOk={async () => {
                    const v = await form.validateFields();
                    mut.mutate(v);
                }}
            >
                <Form form={form} layout="vertical" initialValues={{ valor: 0 }}>
                    <Form.Item label="Concepto" name="concepto" rules={[{ required: true }]}>
                        <Input placeholder="Ej: Derechos, Trámite, etc." />
                    </Form.Item>
                    <Form.Item label="Valor" name="valor" rules={[{ required: true }]}>
                        <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
}
