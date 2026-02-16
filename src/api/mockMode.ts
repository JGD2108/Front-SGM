export type MockMode = "auto" | "force" | "off";

function normalizeMockMode(value: unknown): MockMode {
  const raw = String(value ?? "off").toLowerCase();
  if (raw === "force" || raw === "auto" || raw === "off") return raw;
  return "off";
}

export const MOCK_MODE: MockMode = normalizeMockMode(import.meta.env.VITE_MOCK_MODE);
