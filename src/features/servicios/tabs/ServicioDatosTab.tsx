// src/features/servicios/tabs/ServicioDatosTab.tsx
import { Alert, Button, Form, Space, message } from "antd";
import { useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ServiceTemplate } from "../../../api/servicioTemplates";
import type { ServicioDetail } from "../../../api/servicios";
import { patchServicio } from "../../../api/servicios";
import DynamicServiceForm, { buildInitialServiceData, coerceServiceDataForSave } from "../components/DynamicServiceForm";

export default function ServicioDatosTab(props: {
  servicioId: string;
  locked: boolean;
  template: ServiceTemplate | null;
  servicio?: ServicioDetail;
}) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [form] = Form.useForm();

  const mergedInitial = useMemo(() => {
    if (!props.template) return {};
    const base = buildInitialServiceData(props.template);
    const server = props.servicio?.service_data ?? null;
    return { ...base, ...(server ?? {}) };
  }, [props.template, props.servicio?.service_data]);

  // set initial values cuando carga
  useEffect(() => {
    if (!props.template) return;
    form.setFieldsValue({
      gestorNombre: props.servicio?.gestor_nombre ?? "",
      gestorTelefono: props.servicio?.gestor_telefono ?? "",
      ...mergedInitial,
    });
  }, [props.template, props.servicio?.gestor_nombre, props.servicio?.gestor_telefono, mergedInitial, form]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!props.template) throw new Error("NO_TEMPLATE");

      const values = await form.validateFields();

      const gestorNombre = values.gestorNombre || undefined;
      const gestorTelefono = values.gestorTelefono || undefined;

      // solo serviceData (campos del template)
      const rawServiceData: Record<string, any> = {};
      for (const f of props.template.campos) rawServiceData[f.key] = values[f.key];

      const serviceData = coerceServiceDataForSave(props.template, rawServiceData);

      await patchServicio(props.servicioId, { gestorNombre, gestorTelefono, serviceData });
      return { ok: true };
    },
    onSuccess: () => {
      msgApi.success("Guardado");
      qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] });
    },
    onError: (e: any) => {
      // 409 lock
      if (e?.response?.status === 409) {
        msgApi.error("Servicio bloqueado (ENTREGADO/CANCELADO).");
        return;
      }
      msgApi.error(e?.response?.data?.message ?? "No se pudo guardar");
    },
  });

  const resetMut = useMutation({
    mutationFn: async () => {
      await patchServicio(props.servicioId, { serviceData: null });
      return { ok: true };
    },
    onSuccess: () => {
      msgApi.success("Formulario limpiado");
      qc.invalidateQueries({ queryKey: ["servicio", props.servicioId] });
      form.resetFields();
    },
    onError: () => msgApi.error("No se pudo limpiar"),
  });

  if (!props.template) {
    return (
      <>
        {ctx}
        <Alert type="warning" showIcon message="No hay template" description="No se encontró template para este tipo de servicio." />
      </>
    );
  }

  return (
    <>
      {ctx}

      {props.locked ? (
        <Alert type="warning" showIcon message="Solo lectura" description="Este servicio está bloqueado." />
      ) : null}

      <Form form={form} layout="vertical" disabled={props.locked || mut.isPending}>
        {/* gestor se guarda por PATCH también */}
        <Form.Item label="Gestor nombre" name="gestorNombre">
          <input className="ant-input" placeholder="Opcional" />
        </Form.Item>

        <Form.Item label="Gestor teléfono" name="gestorTelefono">
          <input className="ant-input" placeholder="Opcional" />
        </Form.Item>

        <DynamicServiceForm template={props.template} />

        <Space>
          <Button type="primary" onClick={() => mut.mutate()} loading={mut.isPending} disabled={props.locked}>
            Guardar
          </Button>
          <Button danger onClick={() => resetMut.mutate()} loading={resetMut.isPending} disabled={props.locked}>
            Reset / Limpiar
          </Button>
        </Space>
      </Form>
    </>
  );
}
