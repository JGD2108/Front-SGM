import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { getToken } from "../../platform/authToken";

export default function AuthGate() {
  const [loading, setLoading] = useState(true);
  const [hasToken, setHasToken] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;

    (async () => {
      const token = await getToken();
      if (!mounted) return;

      setHasToken(!!token);
      setLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [location.pathname]);

  useEffect(() => {
    const onUnauthorized = () => {
      setHasToken(false);
      setLoading(false);
    };

    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!hasToken) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
