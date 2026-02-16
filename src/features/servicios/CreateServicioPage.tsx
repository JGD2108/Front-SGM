import { Button, Card, Form, Input, Select, Space, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";

import { getServicioTemplates } from "../../api/servicioTemplates";
import { createServicio, type CreateServicioInput } from "../../api/servicios";
import { getConcesionarios, getCiudades } from "../../api/catalogs";

export default function CreateServicioPage() {
  const nav = useNavigate();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm<CreateServicioInput>();

  const templatesQuery = useQuery({
    queryKey: ["servicioTemplates"],
    queryFn: getServicioTemplates,
    staleTime: 5 * 60 * 1000,
  });

  const concQuery = useQuery({
    queryKey: ["catalogsConcesionarios"],
    queryFn: getConcesionarios,
    staleTime: 5 * 60 * 1000,
  });

  const ciudadesQuery = useQuery({
    queryKey: ["catalogsCiudades"],
    queryFn: getCiudades,
    staleTime: 5 * 60 * 1000,
  });

  const mut = useMutation({
    mutationFn: (values: CreateServicioInput) => createServicio({ ...values, serviceData: {} }),
    onSuccess: (r) => {
      msgApi.success("Servicio creado");
      nav(`/servicios/${r.id}`);
    },
    onError: (err: any) => {
      // 🔥 aquí ves EXACTO por qué el backend respondió 400
      console.log("CREATE_SERVICIO_ERROR:", err?.response?.data);
      msgApi.error(err?.response?.data?.message ?? "No se pudo crear el servicio (400)");
    },
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

        <Card>
          <Form
            form={form}
            layout="vertical"
            onFinish={(v) => mut.mutate(v)}
            disabled={mut.isPending}
          >
            <Space wrap size={12}>
              <Form.Item label="Tipo servicio" name="tipoServicio" rules={[{ required: true }]} style={{ width: 280 }}>
                <Select
                  loading={templatesQuery.isLoading}
                  options={(templatesQuery.data ?? []).map((t) => ({ value: t.tipo, label: t.nombre }))}
                  placeholder="Selecciona tipo"
                />
              </Form.Item>

              <Form.Item label="Concesionario" name="concesionarioCode" rules={[{ required: true }]} style={{ width: 260 }}>
                <Select
                  showSearch
                  loading={concQuery.isLoading}
                  options={(concQuery.data ?? []).map((c) => ({
                    value: c.code,
                    label: c.name ? `${c.code} — ${c.name}` : c.code,
                  }))}
                  placeholder="Selecciona concesionario"
                  filterOption={(input, opt) => String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>

              <Form.Item label="Ciudad" name="ciudad" rules={[{ required: true }]} style={{ width: 220 }}>
                <Select
                  showSearch
                  loading={ciudadesQuery.isLoading}
                  options={(ciudadesQuery.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
                  placeholder="Selecciona ciudad"
                  filterOption={(input, opt) => String(opt?.label ?? "").toLowerCase().includes(input.toLowerCase())}
                />
              </Form.Item>

              <Form.Item label="Cliente nombre" name="clienteNombre" rules={[{ required: true }]} style={{ width: 260 }}>
                <Input placeholder="Nombre completo" />
              </Form.Item>

              <Form.Item label="Cliente doc" name="clienteDoc" rules={[{ required: true }]} style={{ width: 220 }}>
                <Input placeholder="CC / NIT" />
              </Form.Item>

              <Form.Item label="Gestor (opcional)" name="gestorNombre" style={{ width: 260 }}>
                <Input placeholder="Nombre gestor" />
              </Form.Item>

              <Form.Item label="Teléfono gestor (opcional)" name="gestorTelefono" style={{ width: 220 }}>
                <Input placeholder="3001234567" />
              </Form.Item>
            </Space>

            <div style={{ marginTop: 8 }}>
              <Button type="primary" htmlType="submit" loading={mut.isPending}>
                Crear
              </Button>
            </div>
          </Form>
        </Card>
      </Space>
    </>
  );
}
