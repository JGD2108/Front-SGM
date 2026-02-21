import { useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Space, Typography, Upload, message } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { InboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";

import { getConcesionarios, getCiudades } from "../../api/catalogs";
import { createTramite } from "../../api/createTramite";

const { Dragger } = Upload;

type FormValues = {
  concesionarioCode: string;
  ciudad: string;
  clienteNombre: string;
  clienteDoc: string;
  placa?: string;
};

export default function CreateTramitePage() {
  const nav = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [msgApi, contextHolder] = message.useMessage();

  const concesQuery = useQuery({
    queryKey: ["catalogs", "concesionarios"],
    queryFn: getConcesionarios,
    staleTime: 1000 * 60 * 10,
  });

  const ciudadesQuery = useQuery({
    queryKey: ["catalogs", "ciudades"],
    queryFn: getCiudades,
    staleTime: 1000 * 60 * 10,
  });

  // manejo de archivo (1 solo PDF)
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const facturaFile = useMemo(() => {
    const f = fileList?.[0]?.originFileObj;
    return f ?? null;
  }, [fileList]);

  const createMutation = useMutation({
    mutationFn: createTramite,
    onSuccess: (data) => {
      msgApi.success(`Trámite creado: ${data.display_id}`);
      nav(`/tramites/${data.id}`);
    },
    onError: (err: any) => {
      // luego aquí mapeamos errorCode (422 PDF_TOO_MANY_PAGES etc.)
      msgApi.error(err?.response?.data?.message ?? "No se pudo crear el trámite");
    },
  });

  const beforeUpload = (file: File) => {
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      msgApi.error("La factura debe ser un PDF.");
      return Upload.LIST_IGNORE;
    }
    // Solo 1 archivo
    setFileList([{ uid: file.name, name: file.name, status: "done", originFileObj: file }]);
    return Upload.LIST_IGNORE; // evitamos upload automático (lo hacemos al guardar)
  };

  const onRemove = () => {
    setFileList([]);
  };

  const onSubmit = async () => {
    const values = await form.validateFields();

    if (!facturaFile) {
      msgApi.error("Debes subir la factura (PDF) para crear el trámite.");
      return;
    }

    createMutation.mutate({
      concesionarioCode: values.concesionarioCode,
      ciudad: values.ciudad,
      clienteNombre: values.clienteNombre,
      clienteDoc: values.clienteDoc,
      placa: values.placa?.trim() || undefined,
      facturaFile,
    });
  };

  return (
    <>
      {contextHolder}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Crear trámite
        </Typography.Title>

        <Card>
          <Form form={form} layout="vertical">
            <Space wrap size={12} align="start" style={{ width: "100%" }}>
              <Form.Item
                label="Concesionario"
                name="concesionarioCode"
                rules={[{ required: true, message: "Selecciona concesionario" }]}
                style={{ width: 320 }}
              >
                <Select
                  allowClear
                  placeholder="Selecciona"
                  loading={concesQuery.isLoading}
                  options={(concesQuery.data ?? []).map((c) => ({ value: c.code, label: c.name }))}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item
                label="Ciudad"
                name="ciudad"
                rules={[{ required: true, message: "Selecciona ciudad" }]}
                style={{ width: 260 }}
              >
                <Select
                  allowClear
                  placeholder="Selecciona"
                  loading={ciudadesQuery.isLoading}
                  options={(ciudadesQuery.data ?? []).map((c) => ({ value: c.name, label: c.name }))}
                  showSearch
                  filterOption={(input, option) =>
                    String(option?.label ?? "").toLowerCase().includes(input.toLowerCase())
                  }
                />
              </Form.Item>

              <Form.Item
                label="Cliente nombre"
                name="clienteNombre"
                rules={[{ required: true, message: "Ingresa nombre del cliente" }]}
                style={{ width: 320 }}
              >
                <Input placeholder="Nombre cliente" />
              </Form.Item>

              <Form.Item
                label="Cliente documento"
                name="clienteDoc"
                rules={[{ required: true, message: "Ingresa documento del cliente" }]}
                style={{ width: 240 }}
              >
                <Input placeholder="CC / NIT" />
              </Form.Item>

              <Form.Item label="Placa (opcional)" name="placa" style={{ width: 180 }}>
                <Input placeholder="ABC123" />
              </Form.Item>
            </Space>
          </Form>
        </Card>

        <Card title="Factura (PDF obligatorio)">
          <Dragger
            multiple={false}
            accept=".pdf,application/pdf"
            beforeUpload={beforeUpload}
            fileList={fileList}
            onRemove={onRemove}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">Arrastra la factura PDF aquí o haz clic para seleccionar</p>
            <p className="ant-upload-hint">Máximo 1 archivo. El backend validará máximo 15 páginas.</p>
          </Dragger>

          <Space style={{ marginTop: 16 }}>
            <Button onClick={() => nav("/")}>Volver</Button>
            <Button
              type="primary"
              loading={createMutation.isPending}
              onClick={onSubmit}
              disabled={createMutation.isPending}
            >
              Crear trámite
            </Button>
          </Space>
        </Card>
      </Space>
    </>
  );
}
