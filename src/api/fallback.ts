import type { MockMode } from "./mockMode";
import { MOCK_MODE } from "./mockMode";

export function looksLikeHtml(data: unknown): boolean {
  if (typeof data !== "string") return false;
  const s = data.toLowerCase();
  return s.includes("<!doctype html") || s.includes("<html");
}

export async function withFallback<T>(
  apiCall: () => Promise<T>,
  mockCall: () => Promise<T> | T,
  validate?: (data: T) => boolean
): Promise<T> {
  // force = siempre mocks
  if (MOCK_MODE === "force") return await Promise.resolve(mockCall());

  // off = nunca mocks (si falla, falla)
  if (MOCK_MODE === "off") return apiCall();

  // auto = intenta backend; si falla o es inválido, usa mock
  try {
    const data = await apiCall();

    // Si por alguna razón axios devuelve string HTML:
    if (looksLikeHtml(data)) throw new Error("HTML_RESPONSE");

    if (validate && !validate(data)) throw new Error("INVALID_RESPONSE");

    return data;
  } catch {
    return await Promise.resolve(mockCall());
  }
}
