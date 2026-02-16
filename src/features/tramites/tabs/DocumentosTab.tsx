// src/features/tramite/tabs/DocumentosTab.tsx
import {
  Alert,
  Button,
  Card,
  Drawer,
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

function normDocKey(x: any): string {
  return String(x?.docKey ?? x?.doc_key ?? x?.tipo ?? x?.key ?? x?.docType ?? "");
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

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerDocKey, setDrawerDocKey] = useState<string>("");

  const selectedFiles = filesByDocKey.get(drawerDocKey) ?? [];

  const drawerTitle = useMemo(() => {
    const item = checklistRows.find((c) => c.docKey === drawerDocKey);
    return item ? `Versiones - ${item.name_snapshot}` : `Versiones - ${drawerDocKey}`;
  }, [drawerDocKey, checklistRows]);

  const uploadMut = useMutation({
    mutationFn: (p: { docKey: string; file: File }) =>
      uploadTramiteFile(props.tramiteId, p),
    onSuccess: async (_data, vars) => {
      msgApi.success("Documento subido");
      await qc.invalidateQueries({ queryKey: ["tramiteChecklist", props.tramiteId] });
      await qc.invalidateQueries({ queryKey: ["tramiteFiles", props.tramiteId] });

      setDrawerDocKey(vars.docKey);
      setDrawerOpen(true);
    },
    onError: (err: any) => {
      msgApi.error(err?.response?.data?.message ?? "No se pudo subir el PDF");
    },
  });

  const onCustomUpload = (docKeyRaw: string) => async (opt: UploadRequestOption) => {
    const file = opt.file as File;
    const docKey = String(docKeyRaw);

    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      msgApi.error("Solo se permiten PDFs.");
      opt.onError?.(new Error("NOT_PDF"));
      return;
    }

    try {
      await uploadMut.mutateAsync({ docKey, file });
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
              accept=".pdf,application/pdf"
              showUploadList={false}
              disabled={props.locked}
              customRequest={onCustomUpload(key)}
            >
              <Button icon={<UploadOutlined />} disabled={props.locked} loading={uploadMut.isPending}>
                Subir PDF
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
            description="Solo PDFs. El backend validará máximo 10 páginas."
          />
        )}

        <Card title="Checklist de documentos" loading={checklistQuery.isLoading}>
          <Table<ChecklistRow>
            rowKey={(r) => r.id}
            columns={columns}
            dataSource={checklistRows}
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
