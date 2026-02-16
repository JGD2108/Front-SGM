// src/features/servicios/components/DynamicServiceForm.tsx
import { Form, Input, InputNumber, Select, DatePicker, Typography } from "antd";
import dayjs from "dayjs";
import type { ServiceTemplate, TemplateField } from "../../../api/servicioTemplates";

export function buildInitialServiceData(template: ServiceTemplate): Record<string, any> {
  const obj: Record<string, any> = {};
  for (const f of template.campos ?? []) {
    obj[f.key] = "";
  }
  return obj;
}

function renderField(field: TemplateField) {
  const ph = field.placeholder ?? "";

  switch (field.type) {
    case "text":
      return <Input placeholder={ph} />;
    case "textarea":
      return <Input.TextArea rows={3} placeholder={ph} />;
    case "number":
      return <InputNumber min={0} style={{ width: "100%" }} placeholder={ph} />;
    case "date":
      return <DatePicker style={{ width: "100%" }} format="YYYY-MM-DD" />;
    case "select":
      return (
        <Select
          placeholder={ph || "Selecciona"}
          options={(field.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      );
    default:
      return <Input placeholder={ph} />;
  }
}

export function coerceServiceDataForSave(template: ServiceTemplate, raw: Record<string, any>) {
  const out: Record<string, any> = {};

  for (const f of template.campos ?? []) {
    const v = raw?.[f.key];

    if (f.type === "number") {
      // InputNumber ya da number | null
      out[f.key] = v === null || v === undefined || v === "" ? "" : Number(v);
      continue;
    }

    if (f.type === "date") {
      // DatePicker da Dayjs | null
      out[f.key] = v ? dayjs(v).format("YYYY-MM-DD") : "";
      continue;
    }

    out[f.key] = v ?? "";
  }

  return out;
}

export default function DynamicServiceForm(props: {
  template: ServiceTemplate;
  disabled?: boolean;
}) {
  const { template } = props;

  return (
    <>
      {template.descripcion ? (
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          {template.descripcion}
        </Typography.Paragraph>
      ) : null}

      {template.campos.map((f) => (
        <Form.Item
          key={f.key}
          label={f.label}
          name={f.key}
          rules={f.required ? [{ required: true, message: `Campo obligatorio: ${f.label}` }] : []}
        >
          {renderField(f)}
        </Form.Item>
      ))}
    </>
  );
}
