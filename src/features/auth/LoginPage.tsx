import { Button, Card, Form, Input, Typography, message } from "antd";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/http";
import { setToken } from "../../platform/authToken";

type LoginValues = {
  email: string;
  password: string;
};

export default function LoginPage() {
  const nav = useNavigate();
  const [msgApi, contextHolder] = message.useMessage();

  const onFinish = async (values: LoginValues) => {
    try {
      const res = await api.post("/auth/login", {
        email: values.email,
        password: values.password,
      });

      const token = res.data?.accessToken ?? res.data?.access_token ?? res.data?.token;
      if (!token) {
        msgApi.error("Login OK pero el backend no devolvio token (revisa accessToken).");
        return;
      }

      await setToken(token);
      msgApi.success("Sesion iniciada");
      nav("/", { replace: true });
    } catch (e: any) {
      const data = e?.response?.data;
      msgApi.error(data?.message ?? "No se pudo iniciar sesion");
    }
  };

  return (
    <>
      {contextHolder}
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          Iniciar sesion
        </Typography.Title>

        <Form<LoginValues> layout="vertical" onFinish={onFinish}>
          <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
            <Input placeholder="correo@dominio.com" />
          </Form.Item>

          <Form.Item label="Contrasena" name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="********" />
          </Form.Item>

          <Button type="primary" htmlType="submit" block>
            Entrar
          </Button>
        </Form>
      </Card>
    </>
  );
}
