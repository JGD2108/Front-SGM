import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Descriptions,
  Modal,
  Space,
  Tabs,
  Tag,
  Typography,
  message,
  Input,
  Select,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import EstadosTab from "./tabs/EstadosTab";
import DocumentosTab from "./tabs/DocumentosTab";
import PagosTab from "./tabs/PagosTab";
import EnviosTab from "./tabs/EnviosTab";
import ResumenTab from "./tabs/ResumenTab";

import { getTramiteById } from "../../api/tramiteDetail";
import type { TramiteEstado } from "../../api/types";
import { cancelarTramite, finalizarTramite, reabrirTramite } from "../../api/tramiteActions";
import { patchTramite } from "../../api/tramiteUpdate";

const ESTADOS: { value: TramiteEstado; label: string }[] = [
  { value: "FACTURA_RECIBIDA", label: "Factura recibida" },
  { value: "PREASIGNACION_SOLICITADA", label: "Preasignación solicitada" },
  { value: "PLACA_ASIGNADA", label: "Placa asignada" },
  { value: "PLACA_ENVIADA_CONCESIONARIO", label: "Placa enviada" },
  { value: "DOCS_FISICOS_PENDIENTES", label: "Docs físicos pendientes" },
  { value: "DOCS_FISICOS_COMPLETOS", label: "Docs físicos completos" },
  { value: "ENVIADO_GESTOR_TRANSITO", label: "Enviado a gestor" },
  { value: "TIMBRE_PAGADO", label: "Timbre pagado" },
  { value: "DERECHOS_PAGADOS", label: "Derechos pagados" },
  { value: "FINALIZADO_ENTREGADO", label: "Finalizado" },
  { value: "CANCELADO", label: "Cancelado" },
];

function estadoTag(estado: TramiteEstado) {
  if (estado === "FINALIZADO_ENTREGADO") return <Tag color="green">Finalizado</Tag>;
  if (estado === "CANCELADO") return <Tag color="red">Cancelado</Tag>;
  return <Tag>{estado}</Tag>;
}

export default function TramiteDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [msgApi, contextHolder] = message.useMessage();

  if (!id) return null;

  const tramiteQuery = useQuery({
    queryKey: ["tramite", id],
    queryFn: () => getTramiteById(id),
  });

  const tramite = tramiteQuery.data;
  const isFinalizado = tramite?.estado_actual === "FINALIZADO_ENTREGADO";
  const isCancelado = tramite?.estado_actual === "CANCELADO";
  const locked = isFinalizado || isCancelado;

  // ====== MODAL PLACA ======
  const [placaOpen, setPlacaOpen] = useState(false);
  const [placaValue, setPlacaValue] = useState("");

  const placaMut = useMutation({
    mutationFn: (placa: string) => patchTramite(id, { placa }),
    onSuccess: () => {
      msgApi.success("Placa actualizada");
      setPlacaOpen(false);
      qc.invalidateQueries({ queryKey: ["tramite", id] });
    },
    onError: (e: any) => {
      msgApi.error(e?.response?.data?.message ?? "No se pudo actualizar la placa");
    },
  });

  // ====== MODALES ACCIÓN ======
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [reabrirReason, setReabrirReason] = useState("");
  const [reabrirToEstado, setReabrirToEstado] = useState<TramiteEstado>("DOCS_FISICOS_PENDIENTES");

  const finalizarMut = useMutation({
    mutationFn: () => finalizarTramite(id),
    onSuccess: () => {
      msgApi.success("Trámite finalizado");
      qc.invalidateQueries({ queryKey: ["tramite", id] });
    },
    onError: (e: any) => {
      msgApi.error(e?.response?.data?.message ?? "No se pudo finalizar");
    },
  });

  const cancelarMut = useMutation({
    mutationFn: () => cancelarTramite(id, cancelReason || undefined),
    onSuccess: () => {
      msgApi.success("Trámite cancelado");
      setCancelOpen(false);
      setCancelReason("");
      qc.invalidateQueries({ queryKey: ["tramite", id] });
    },
    onError: (e: any) => {
      msgApi.error(e?.response?.data?.message ?? "No se pudo cancelar");
    },
  });

  const reabrirMut = useMutation({
    mutationFn: () => reabrirTramite(id, { reason: reabrirReason, toEstado: reabrirToEstado }),
    onSuccess: () => {
      msgApi.success("Trámite reabierto");
      setReabrirOpen(false);
      setReabrirReason("");
      qc.invalidateQueries({ queryKey: ["tramite", id] });
    },
    onError: (e: any) => {
      msgApi.error(e?.response?.data?.message ?? "No se pudo reabrir");
    },
  });

  // ====== UI HEADER ======
  const headerRight = useMemo(() => {
    return (
      <Space>
        <Button onClick={() => nav("/")}>Volver</Button>

        <Button
          disabled={locked}
          onClick={() => {
            setPlacaValue(tramite?.placa ?? "");
            setPlacaOpen(true);
          }}
        >
          Editar placa
        </Button>

        <Button danger disabled={isCancelado} onClick={() => setCancelOpen(true)}>
          Cancelar
        </Button>

        <Button
          type="primary"
          disabled={isCancelado || isFinalizado}
          loading={finalizarMut.isPending}
          onClick={() => finalizarMut.mutate()}
        >
          Finalizar
        </Button>

        <Button disabled={!isFinalizado || isCancelado} onClick={() => setReabrirOpen(true)}>
          Reabrir
        </Button>
      </Space>
    );
  }, [nav, locked, tramite?.placa, isCancelado, isFinalizado, finalizarMut.isPending]);

  return (
    <>
      {contextHolder}

      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Space align="start" style={{ justifyContent: "space-between", width: "100%" }}>
          <div>
            <Typography.Title level={3} style={{ margin: 0 }}>
              Detalle del trámite
            </Typography.Title>

            {tramite ? (
              <Space style={{ marginTop: 4 }}>
                <Typography.Text strong>{tramite.display_id}</Typography.Text>
                {estadoTag(tramite.estado_actual)}
                {tramite.is_atrasado ? <Tag color="orange">Atrasado</Tag> : null}
              </Space>
            ) : null}
          </div>

          {headerRight}
        </Space>

        <Card loading={tramiteQuery.isLoading}>
          {tramite ? (
            <Descriptions column={3} size="small">
              <Descriptions.Item label="ID">{tramite.display_id}</Descriptions.Item>
              <Descriptions.Item label="Concesionario">{tramite.concesionario_code}</Descriptions.Item>
              <Descriptions.Item label="Ciudad">{tramite.ciudad_nombre ?? "-"}</Descriptions.Item>

              <Descriptions.Item label="Placa">{tramite.placa ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Cliente">{tramite.cliente_nombre ?? "-"}</Descriptions.Item>
              <Descriptions.Item label="Doc">{tramite.cliente_doc ?? "-"}</Descriptions.Item>
            </Descriptions>
          ) : (
            <Typography.Text>Sin datos</Typography.Text>
          )}
        </Card>

        <Card>
          <Tabs
            items={[
              {
                key: "resumen",
                label: "Resumen",
                children: <ResumenTab tramiteId={id} locked={locked} />,
              },
              {
                key: "estados",
                label: "Estados",
                children: (
                  <EstadosTab
                    tramiteId={id}
                    estadoActual={tramite?.estado_actual ?? "FACTURA_RECIBIDA"}
                    locked={locked}
                  />
                ),
              },
              {
                key: "documentos",
                label: "Documentos",
                children: <DocumentosTab tramiteId={id} locked={locked} />,
              },
              {
                key: "envios",
                label: "Envíos",
                children: <EnviosTab tramiteId={id} locked={locked} />,
              },
              {
                key: "pagos",
                label: "Pagos",
                children: <PagosTab tramiteId={id} locked={locked} />,
              },
            ]}
          />
        </Card>
      </Space>

      {/* ===== Modal Placa ===== */}
      <Modal
        title="Asignar / corregir placa"
        open={placaOpen}
        onCancel={() => setPlacaOpen(false)}
        okText="Guardar"
        okButtonProps={{ loading: placaMut.isPending }}
        onOk={() => {
          const p = placaValue.trim().toUpperCase();
          if (!p) {
            msgApi.error("La placa no puede estar vacía");
            return;
          }
          placaMut.mutate(p);
        }}
      >
        <Input
          value={placaValue}
          onChange={(e) => setPlacaValue(e.target.value)}
          placeholder="Ej: ABC123"
          maxLength={10}
          disabled={locked}
        />
        {locked ? (
          <div style={{ marginTop: 8, color: "#b45309" }}>
            *Bloqueado por estado (finalizado/cancelado).*
          </div>
        ) : null}
      </Modal>

      {/* Modal Cancelar */}
      <Modal
        title="Cancelar trámite"
        open={cancelOpen}
        onCancel={() => setCancelOpen(false)}
        onOk={() => cancelarMut.mutate()}
        okButtonProps={{ danger: true, loading: cancelarMut.isPending }}
        okText="Cancelar trámite"
      >
        <Typography.Paragraph>Puedes agregar un motivo (opcional).</Typography.Paragraph>
        <Input.TextArea
          rows={4}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Motivo de cancelación"
        />
      </Modal>

      {/* Modal Reabrir */}
      <Modal
        title="Reabrir trámite"
        open={reabrirOpen}
        onCancel={() => setReabrirOpen(false)}
        onOk={() => {
          if (!reabrirReason.trim()) {
            msgApi.error("El motivo de reabrir es obligatorio.");
            return;
          }
          reabrirMut.mutate();
        }}
        okButtonProps={{ loading: reabrirMut.isPending }}
        okText="Reabrir"
      >
        <Typography.Paragraph>Motivo obligatorio (regla del proyecto).</Typography.Paragraph>

        <Input.TextArea
          rows={3}
          value={reabrirReason}
          onChange={(e) => setReabrirReason(e.target.value)}
          placeholder="Motivo de reapertura"
        />

        <div style={{ marginTop: 12 }}>
          <Typography.Text strong>Volver a estado:</Typography.Text>
          <Select
            style={{ width: "100%", marginTop: 8 }}
            value={reabrirToEstado}
            onChange={(v) => setReabrirToEstado(v)}
            options={ESTADOS.filter((e) => e.value !== "CANCELADO").map((e) => ({
              value: e.value,
              label: e.label,
            }))}
          />
        </div>
      </Modal>
    </>
  );
}
