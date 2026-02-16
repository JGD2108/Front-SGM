// src/app/layout/MainLayout.tsx
import { Layout, Menu, Button } from "antd";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { clearToken } from "../../platform/authToken";

const { Sider, Content, Header } = Layout;

export default function MainLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const path = loc.pathname;

  // ✅ Marca el menú activo según la ruta
  const selectedKey =
    path.startsWith("/tramites/nuevo") ? "create" :
    path.startsWith("/servicios/nuevo") ? "servicios_create" :
    path.startsWith("/servicios") ? "servicios" :
    path.startsWith("/atrasados") ? "atrasados" :
    path.startsWith("/reportes") ? "reports" :
    "tray"; // incluye "/" y "/tramites/:id"

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220}>
        <div style={{ color: "white", padding: 16, fontWeight: 700 }}>SGM</div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            { key: "tray", label: "Bandeja", onClick: () => nav("/") },
            { key: "create", label: "Crear trámite", onClick: () => nav("/tramites/nuevo") },

            // ✅ Servicios
            { key: "servicios", label: "Servicios", onClick: () => nav("/servicios") },
            { key: "servicios_create", label: "Nuevo servicio", onClick: () => nav("/servicios/nuevo") },

            { key: "atrasados", label: "Atrasados", onClick: () => nav("/atrasados") },
            { key: "reports", label: "Reportes", onClick: () => nav("/reportes") },
          ]}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ fontWeight: 600 }}>Sistema de Gestión de Matrículas</div>

          <Button
            onClick={async () => {
              await clearToken();
              nav("/login", { replace: true });
            }}
          >
            Cerrar sesión
          </Button>
        </Header>

        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
