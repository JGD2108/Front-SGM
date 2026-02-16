// src/features/servicios/ServicioCreatePage.tsx
import { Button, Card, Form, Input, Select, Space, Typography, message } from "antd";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

import { getServicioTemplates } from "../../api/servicioTemplates";
import { createServicio } from "../../api/servicios";

export default function ServicioCreatePage() {
  const nav = useNavigate();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const templatesQuery = useQuery({
    queryKey: ["servicioTemplates"],
    queryFn: getServicioTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: (values: any) => createServicio(values),
    onSuccess: (r) => {
      msgApi.success("Servicio creado");
      nav(`/servicios/${r.id}`);
    },
    onError: (e: any) => msgApi.error(e?.response?.data?.message ?? "No se pudo crear"),
  });

  return (
    <>
      {ctx}
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space style={{ justifyContent: "space-between", width: "100%" }}>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Nuevo servicio
          </Typography.Title>
          <Button onClick={() => nav("/servicios")}>Volver</Button>
        </Space>

        <Card style={{ maxWidth: 720 }}>
          <Form form={form} layout="vertical" onFinish={(v) => mut.mutate(v)}>
            <Form.Item label="Tipo de servicio" name="tipoServicio" rules={[{ required: true }]}>
              <Select
                loading={templatesQuery.isLoading}
                options={(templatesQuery.data ?? []).map((t) => ({ value: t.tipo, label: t.nombre }))}
              />
            </Form.Item>

            <Form.Item label="Concesionario (code)" name="concesionarioCode" rules={[{ required: true }]}>
              <Input placeholder="Ej: AUTOTROPICAL" />
            </Form.Item>

            <Form.Item label="Ciudad" name="ciudad" rules={[{ required: true }]}>
              <Input placeholder="Ej: Barranquilla" />
            </Form.Item>

            <Form.Item label="Cliente nombre" name="clienteNombre" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item label="Cliente doc" name="clienteDoc" rules={[{ required: true }]}>
              <Input />
            </Form.Item>

            <Form.Item label="Gestor nombre (opcional)" name="gestorNombre">
              <Input />
            </Form.Item>

            <Form.Item label="Gestor teléfono (opcional)" name="gestorTelefono">
              <Input />
            </Form.Item>

            <Button type="primary" htmlType="submit" loading={mut.isPending}>
              Crear
            </Button>
          </Form>
        </Card>
      </Space>
    </>
  );
}
