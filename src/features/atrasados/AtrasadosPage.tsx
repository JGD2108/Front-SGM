import { Card, Input, Space, Table, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { getAtrasados, type AtrasadoItem } from "../../api/atrasados";

export default function AtrasadosPage() {
  const nav = useNavigate();
  const [q, setQ] = useState("");

  const atrasadosQuery = useQuery({
    queryKey: ["atrasados"],
    queryFn: () => getAtrasados(),
  });

  const data = useMemo(() => {
    const arr = atrasadosQuery.data ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return arr;

    return arr.filter((i) => {
      const t = i.tramite;
      return (
        t.display_id.toLowerCase().includes(s) ||
        (t.placa ?? "").toLowerCase().includes(s) ||
        (t.concesionario_code ?? "").toLowerCase().includes(s) ||
        (t.ciudad_nombre ?? "").toLowerCase().includes(s) ||
        (t.cliente_doc ?? "").toLowerCase().includes(s) ||
        (t.cliente_nombre ?? "").toLowerCase().includes(s)
      );
    });
  }, [atrasadosQuery.data, q]);

  const cols: ColumnsType<AtrasadoItem> = [
    {
      title: "Trámite",
      key: "tramite",
      render: (_, r) => (
        <Space direction="vertical" size={0}>
          <Typography.Link onClick={() => nav(`/tramites/${r.tramite.id}`)}>
            {r.tramite.display_id}
          </Typography.Link>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {r.tramite.concesionario_code} — {r.tramite.ciudad_nombre ?? "-"} — {r.tramite.placa ?? "-"}
          </Typography.Text>
        </Space>
      ),
      width: 320,
    },
    { title: "Estado", dataIndex: ["tramite", "estado_actual"], key: "estado", width: 200, render: (v) => <Tag>{v}</Tag> },
    { title: "Días atraso", dataIndex: "daysLate", key: "daysLate", width: 120, render: (v) => <Tag color="orange">{v}</Tag> },
    { title: "Regla", dataIndex: "rule", key: "rule" },
  ];

  return (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <Space style={{ justifyContent: "space-between", width: "100%" }} wrap>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Atrasados
        </Typography.Title>
        <Input.Search
          placeholder="Buscar por ID, placa, concesionario, cliente..."
          style={{ width: 420, maxWidth: "100%" }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          allowClear
        />
      </Space>

      <Card loading={atrasadosQuery.isLoading}>
        <Table<AtrasadoItem>
          rowKey={(r) => r.tramite.id}
          columns={cols}
          dataSource={data}
          pagination={{ pageSize: 20 }}
        />
      </Card>
    </Space>
  );
}
