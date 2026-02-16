// src/app/router.tsx
import { createHashRouter } from "react-router-dom";
import AuthLayout from "./layout/AuthLayout";
import MainLayout from "./layout/MainLayout";
import LoginPage from "../features/auth/LoginPage";
import AuthGate from "../features/auth/AuthGate";
import TramitesListPage from "../features/tray/TramitesListPage";
import TramiteDetailPage from "../features/tramites/TramiteDetailPage";
import CreateTramitePage from "../features/tramites/CreateTramitePage";
import AtrasadosPage from "../features/atrasados/AtrasadosPage";
import ReportesPage from "../features/reportes/ReportesPage";

// ✅ NUEVO
import ServiciosListPage from "../features/servicios/ServiciosListPage";
import CreateServicioPage from "../features/servicios/CreateServicioPage";
import ServicioDetailPage from "../features/servicios/ServicioDetailPage";

export const router = createHashRouter([
  {
    element: <AuthLayout />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <AuthGate />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: "/", element: <TramitesListPage /> },
          { path: "/tramites/nuevo", element: <CreateTramitePage /> },
          { path: "/tramites/:id", element: <TramiteDetailPage /> },

          { path: "/servicios", element: <ServiciosListPage /> },
          { path: "/servicios/nuevo", element: <CreateServicioPage /> },
          { path: "/servicios/:id", element: <ServicioDetailPage /> },

          { path: "/atrasados", element: <AtrasadosPage /> },
          { path: "/reportes", element: <ReportesPage /> },
        ],
      },
    ],
  },
]);
