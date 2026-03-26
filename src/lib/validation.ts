import type { IncomingMessagePayload } from "../contracts";
import { AppError } from "./errors";

export const parseJsonBody = async (request: Request): Promise<unknown> => {
  try {
    return await request.json<unknown>();
  } catch (error) {
    throw new AppError(400, "invalid_json", "请求体必须是合法 JSON。", {
      cause: error instanceof Error ? error.message : String(error)
    });
  }
};

export const validateSource = (source: string): string => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(source)) {
    throw new AppError(400, "invalid_source", "source 仅支持字母、数字、下划线和中划线，长度 1-64。");
  }

  return source;
};

export const validateIncomingMessage = (input: unknown): IncomingMessagePayload => {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new AppError(400, "invalid_payload", "请求体必须是对象。");
  }

  const payload = input as Record<string, unknown>;
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const traceId = typeof payload.traceId === "string" && payload.traceId.trim() !== "" ? payload.traceId.trim() : undefined;
  const dedupeKey =
    typeof payload.dedupeKey === "string" && payload.dedupeKey.trim() !== "" ? payload.dedupeKey.trim() : undefined;
  const meta = payload.meta;

  if (!text) {
    throw new AppError(400, "missing_text", "text 不能为空。");
  }

  if (meta !== undefined && (typeof meta !== "object" || meta === null || Array.isArray(meta))) {
    throw new AppError(400, "invalid_meta", "meta 必须是对象。");
  }

  return {
    text,
    traceId,
    dedupeKey,
    meta: meta as Record<string, unknown> | undefined
  };
};
