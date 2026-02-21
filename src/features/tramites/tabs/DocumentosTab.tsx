// src/features/tramite/tabs/DocumentosTab.tsx
import {
  Alert,
  Button,
  Card,
  Drawer,
  Input,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import type { UploadRequestOption } from "rc-upload/lib/interface";
import {
  UploadOutlined,
  FilePdfOutlined,
  EyeOutlined,
  DownloadOutlined,
} from "@ant-design/icons";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";

import {
  downloadFile,
  getChecklist,
  getTramiteFiles,
  uploadTramiteFile,
} from "../../../api/tramiteDocumentos";

const OTHER_DOC_KEY = "OTRO";
const CUSTOM_DOC_PREFIX = "CUSTOM__";
const ACCEPTED_DOC_EXTENSIONS = [".pdf"];
const ACCEPTED_DOC_MIME_TYPES = new Set(["application/pdf"]);
const UPLOAD_ACCEPT = ".pdf,application/pdf";

function normDocKey(x: any): string {
  return String(x?.docKey ?? x?.doc_key ?? x?.tipo ?? x?.key ?? x?.docType ?? "");
}

function isAllowedDoc(file: File): boolean {
  const name = file.name.toLowerCase();
  if (ACCEPTED_DOC_EXTENSIONS.some((ext) => name.endsWith(ext))) return true;
  return ACCEPTED_DOC_MIME_TYPES.has((file.type ?? "").toLowerCase());
}

function getCustomLabelFromDocKey(docKey: string): string | null {
  if (!docKey.startsWith(CUSTOM_DOC_PREFIX)) return null;
  const slug = docKey.slice(CUSTOM_DOC_PREFIX.length);
  if (!slug) return "Documento";

  return slug
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

function sanitizeFilenameBase(name: string): string {
  const clean = name
    .trim()
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ");
  return clean || "documento";
}

function getPreferredExtension(file: File): string {
  const lower = file.name.toLowerCase();
  const byName = ACCEPTED_DOC_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (byName) return byName;
  return ".pdf";
}

function renameFileWithLabel(file: File, label: string): File {
  const ext = getPreferredExtension(file);
  const base = sanitizeFilenameBase(label);
  const filename = base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;

  return new File([file], filename, {
    type: file.type || "application/octet-stream",
    lastModified: file.lastModified,
  });
}

// ===== Tipos UI estables (no dependen de mock/backend) =====
type ChecklistRow = {
  id: string;
  docKey: string;
  name_snapshot: string;
  required: boolean;
  status: "RECIBIDO" | "PENDIENTE";
  received_at?: string | null;
};

type FileRow = {
  id: string;
  docKey: string;
  version: number;
  filename_original: string;
  uploaded_at: string;
  uploaded_by: string;
};

function normalizeChecklistRow(raw: any): ChecklistRow {
  const docKey = normDocKey(raw) || "UNKNOWN";
  const name_snapshot = String(
    raw?.name_snapshot ?? raw?.nameSnapshot ?? raw?.nombre ?? raw?.name ?? docKey
  );

  const required = Boolean(raw?.required ?? raw?.is_required ?? raw?.obligatorio ?? raw?.isRequired);

  const received_at = (raw?.received_at ?? raw?.receivedAt ?? null) as string | null;
  const statusRaw = String(raw?.status ?? raw?.estado ?? "").toUpperCase();

  const status: "RECIBIDO" | "PENDIENTE" =
    statusRaw === "RECIBIDO" || !!received_at ? "RECIBIDO" : "PENDIENTE";

  const id = String(raw?.id ?? raw?.docId ?? docKey);

  return { id, docKey, name_snapshot, required, status, received_at };
}

function normalizeFileRow(raw: any): FileRow {
  const docKey = normDocKey(raw) || "UNKNOWN";

  const version = Number(raw?.version ?? raw?.ver ?? 1) || 1;

  const filename_original = String(
    raw?.filename_original ??
      raw?.filenameOriginal ??
      raw?.originalName ??
      raw?.filename ??
      `documento_${raw?.id ?? "pdf"}.pdf`
  );

  const uploaded_at = String(raw?.uploaded_at ?? raw?.uploadedAt ?? raw?.created_at ?? raw?.createdAt ?? new Date().toISOString());
  const uploaded_by = String(raw?.uploaded_by ?? raw?.uploadedBy ?? raw?.user ?? raw?.username ?? "—");

  return {
    id: String(raw?.id),
    docKey,
    version,
    filename_original,
    uploaded_at,
    uploaded_by,
  };
}

export default function DocumentosTab(props: { tramiteId: string; locked: boolean }) {
  const qc = useQueryClient();
  const [msgApi, ctx] = message.useMessage();
  const [customDocName, setCustomDocName] = useState("");

  const checklistQuery = useQuery({
    queryKey: ["tramiteChecklist", props.tramiteId],
    queryFn: () => getChecklist(props.tramiteId),
  });

  const filesQuery = useQuery({
    queryKey: ["tramiteFiles", props.tramiteId],
    queryFn: () => getTramiteFiles(props.tramiteId),
  });

  const checklistRows: ChecklistRow[] = useMemo(() => {
    return (checklistQuery.data ?? []).map(normalizeChecklistRow);
  }, [checklistQuery.data]);

  const customTargetDocKey = useMemo(() => {
    const keys = new Set(checklistRows.map((x) => x.docKey));
    if (keys.has(OTHER_DOC_KEY)) return OTHER_DOC_KEY;
    if (keys.has("DOCS_FISICOS")) return "DOCS_FISICOS";
    if (keys.has("DOC_FISICO")) return "DOC_FISICO";
    return null;
  }, [checklistRows]);

  const fileRows: FileRow[] = useMemo(() => {
    return (filesQuery.data ?? []).map(normalizeFileRow);
  }, [filesQuery.data]);

  const filesByDocKey = useMemo(() => {
    const map = new Map<string, FileRow[]>();
    for (const f of fileRows) {
      const arr = map.get(f.docKey) ?? [];
      arr.push(f);
      map.set(f.docKey, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => (b.version ?? 0) - (a.version ?? 0));
      map.set(k, arr);
    }
    return map;
  }, [fileRows]);

  const checklistRowsMerged: ChecklistRow[] = useMemo(() => {
    const base = [...checklistRows];
    const seen = new Set(base.map((r) => r.docKey));

    for (const [docKey, files] of filesByDocKey.entries()) {
      if (seen.has(docKey)) continue;

      base.push({
        id: `virtual-${docKey}`,
        docKey,
        name_snapshot: getCustomLabelFromDocKey(docKey) ?? docKey,
        required: false,
        status: files.length > 0 ? "RECIBIDO" : "PENDIENTE",
        received_at: files[0]?.uploaded_at ?? null,
      });
      seen.add(docKey);
    }

    return base;
  }, [checklistRows, filesByDocKey]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDocKey, setDrawerDocKey] = useState<string>("");

  const selectedFiles = filesByDocKey.get(drawerDocKey) ?? [];

  const drawerTitle = useMemo(() => {
    const item = checklistRowsMerged.find((c) => c.docKey === drawerDocKey);
    return item ? `Versiones - ${item.name_snapshot}` : `Versiones - ${drawerDocKey}`;
  }, [drawerDocKey, checklistRowsMerged]);

  const uploadMut = useMutation({
    mutationFn: async (p: { docKey: string; file: File }) => {
      await uploadTramiteFile(props.tramiteId, { docKey: p.docKey, file: p.file });
      return { docKeyUsed: p.docKey };
    },
    onSuccess: async (data) => {
      msgApi.success("Documento subido");
      await qc.invalidateQueries({ queryKey: ["tramiteChecklist", props.tramiteId] });
      await qc.invalidateQueries({ queryKey: ["tramiteFiles", props.tramiteId] });

      setDrawerDocKey(data.docKeyUsed);
      setDrawerOpen(true);
    },
    onError: (err: any) => {
      msgApi.error(err?.response?.data?.message ?? "No se pudo subir el archivo");
    },
  });

  const onCustomUpload = (docKeyRaw: string) => async (opt: UploadRequestOption) => {
    const file = opt.file as File;
    const docKey = String(docKeyRaw);

    if (!isAllowedDoc(file)) {
      msgApi.error("Solo se permiten PDFs.");
      opt.onError?.(new Error("NOT_ALLOWED_FILE"));
      return;
    }

    try {
      await uploadMut.mutateAsync({ docKey, file });
      opt.onSuccess?.({}, file);
    } catch (e) {
      opt.onError?.(e as any);
    }
  };

  const onCustomNamedUpload = async (opt: UploadRequestOption) => {
    const file = opt.file as File;
    const label = customDocName.trim();

    if (!label) {
      msgApi.error("Escribe un nombre para el documento antes de subir.");
      opt.onError?.(new Error("MISSING_LABEL"));
      return;
    }

    if (!isAllowedDoc(file)) {
      msgApi.error("Solo se permiten PDFs.");
      opt.onError?.(new Error("NOT_ALLOWED_FILE"));
      return;
    }

    if (!customTargetDocKey) {
      msgApi.error("No hay un tipo de documento flexible disponible en el checklist.");
      opt.onError?.(new Error("NO_CUSTOM_DOC_KEY"));
      return;
    }

    try {
      const renamed = renameFileWithLabel(file, label);
      await uploadMut.mutateAsync({
        docKey: customTargetDocKey,
        file: renamed,
      });
      opt.onSuccess?.({}, file);
    } catch (e) {
      opt.onError?.(e as any);
    }
  };

  const doDownload = async (f: FileRow) => {
    try {
      const blob = await downloadFile(f.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = f.filename_original || `documento_${f.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      msgApi.error("No se pudo descargar");
    }
  };

  const columns: ColumnsType<ChecklistRow> = [
    {
      title: "Documento",
      dataIndex: "name_snapshot",
      key: "name_snapshot",
      render: (v: string, r) => (
        <Space>
          <FilePdfOutlined />
          <span style={{ fontWeight: 600 }}>{v}</span>
          {r.required ? <Tag color="blue">Obligatorio</Tag> : <Tag>Opcional</Tag>}
        </Space>
      ),
      width: 360,
    },
    {
      title: "Estado",
      key: "status",
      width: 160,
      render: (_, r) =>
        r.status === "RECIBIDO" ? <Tag color="green">RECIBIDO</Tag> : <Tag>PENDIENTE</Tag>,
    },
    {
      title: "Recibido",
      dataIndex: "received_at",
      key: "received_at",
      width: 190,
      render: (iso?: string | null) => (iso ? dayjs(iso).format("YYYY-MM-DD HH:mm") : "—"),
    },
    {
      title: "Versiones",
      key: "versions",
      width: 130,
      render: (_, r) => {
        const n = filesByDocKey.get(r.docKey)?.length ?? 0;
        return <Tag>{n}</Tag>;
      },
    },
    {
      title: "Acciones",
      key: "actions",
      render: (_, r) => {
        const key = r.docKey;

        return (
          <Space>
            <Upload
              accept={UPLOAD_ACCEPT}
              multiple
              showUploadList={false}
              disabled={props.locked}
              customRequest={onCustomUpload(key)}
            >
              <Button icon={<UploadOutlined />} disabled={props.locked} loading={uploadMut.isPending}>
                Subir archivo
              </Button>
            </Upload>

            <Button
              icon={<EyeOutlined />}
              onClick={() => {
                setDrawerDocKey(key);
                setDrawerOpen(true);
              }}
            >
              Ver
            </Button>
          </Space>
        );
      },
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
            message="Documentos bloqueados"
            description="Este trámite está finalizado o cancelado. Solo puedes ver/descargar."
          />
        ) : (
          <Alert
            type="info"
            showIcon
            message="Regla importante"
            description="Solo PDFs. El backend validará máximo 15 páginas."
          />
        )}

        <Card title="Documentos personalizados">
          <Space wrap size={12}>
            <Input
              placeholder="Nombre del documento (ej. Foto placa)"
              value={customDocName}
              onChange={(e) => setCustomDocName(e.target.value)}
              style={{ width: 320 }}
              disabled={props.locked}
            />
            <Upload
              accept={UPLOAD_ACCEPT}
              multiple
              showUploadList={false}
              disabled={props.locked || !customDocName.trim() || !customTargetDocKey}
              customRequest={onCustomNamedUpload}
            >
              <Button
                icon={<UploadOutlined />}
                disabled={props.locked || !customDocName.trim() || !customTargetDocKey}
                loading={uploadMut.isPending}
              >
                Subir con nombre
              </Button>
            </Upload>
          </Space>
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">
              {customTargetDocKey
                ? "Escribe el nombre y luego selecciona uno o varios archivos."
                : "El backend no expone un docKey flexible (OTRO/DOCS_FISICOS). Usa los botones del checklist."}
            </Typography.Text>
          </div>
        </Card>

        <Card title="Checklist de documentos" loading={checklistQuery.isLoading || filesQuery.isLoading}>
          <Table<ChecklistRow>
            rowKey={(r) => r.id}
            columns={columns}
            dataSource={checklistRowsMerged}
            pagination={false}
            scroll={{ x: 1000 }}
          />
        </Card>
      </Space>

      <Drawer
        title={drawerTitle}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        width={720}
      >
        {drawerDocKey ? (
          selectedFiles.length === 0 ? (
            <Typography.Text>No hay archivos subidos.</Typography.Text>
          ) : (
            <Table<FileRow>
              rowKey="id"
              dataSource={selectedFiles}
              pagination={false}
              columns={[
                { title: "Versión", dataIndex: "version", key: "version", width: 90 },
                { title: "Archivo", dataIndex: "filename_original", key: "filename_original" },
                {
                  title: "Fecha",
                  dataIndex: "uploaded_at",
                  key: "uploaded_at",
                  width: 180,
                  render: (iso: string) => dayjs(iso).format("YYYY-MM-DD HH:mm"),
                },
                { title: "Usuario", dataIndex: "uploaded_by", key: "uploaded_by", width: 120 },
                {
                  title: "Descargar",
                  key: "dl",
                  width: 130,
                  render: (_, f) => (
                    <Button icon={<DownloadOutlined />} onClick={() => doDownload(f)}>
                      Descargar
                    </Button>
                  ),
                },
              ]}
            />
          )
        ) : (
          <Typography.Text>Selecciona un documento.</Typography.Text>
        )}
      </Drawer>
    </>
  );
}
