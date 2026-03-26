import { Hono } from "hono";
import * as QRCode from "qrcode";
import type { AppContext, DeliveryStatus } from "./contracts";
import { renderDashboardPage } from "./lib/dashboard-page";
import { AppError, isAppError, isIlinkApiError, toErrorDetails, toErrorMessage } from "./lib/errors";
import { renderDeliveryLogPage } from "./lib/delivery-log-page";
import { getQrcodeRenderContent } from "./lib/ilink-qrcode";
import { renderQrcodeLoginPage } from "./lib/qrcode-page";
import { parseJsonBody, validateIncomingMessage, validateSource } from "./lib/validation";

const extractBearerToken = (authorizationHeader: string | null): string | null => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length).trim();
};

const ALLOWED_DELIVERY_STATUSES = new Set<DeliveryStatus>(["queued", "retrying", "delivered", "failed"]);

const extractAdminToken = (request: Request): string | null => {
  const bearerToken = extractBearerToken(request.headers.get("Authorization"));
  if (bearerToken) {
    return bearerToken;
  }

  const url = new URL(request.url);
  const queryToken = url.searchParams.get("token")?.trim();
  return queryToken || null;
};

const parseDeliveryListQuery = (request: Request): { limit: number; status?: DeliveryStatus; source?: string } => {
  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  const rawStatus = url.searchParams.get("status");
  const rawSource = url.searchParams.get("source")?.trim();

  let limit = 20;
  if (rawLimit) {
    limit = Number.parseInt(rawLimit, 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new AppError(400, "invalid_limit", "limit 必须是 1-100 之间的整数。");
    }
  }

  if (rawStatus && !ALLOWED_DELIVERY_STATUSES.has(rawStatus as DeliveryStatus)) {
    throw new AppError(400, "invalid_status", "status 仅支持 queued、retrying、delivered、failed。");
  }

  if (rawSource) {
    validateSource(rawSource);
  }

  return {
    limit,
    status: rawStatus ? (rawStatus as DeliveryStatus) : undefined,
    source: rawSource || undefined
  };
};

const parseRefreshSeconds = (request: Request, fallback: number): number => {
  const url = new URL(request.url);
  const refreshRaw = url.searchParams.get("refresh");
  if (!refreshRaw) {
    return fallback;
  }

  const refreshSeconds = Number.parseInt(refreshRaw, 10);
  if (!Number.isInteger(refreshSeconds) || refreshSeconds < 0 || refreshSeconds > 300) {
    throw new AppError(400, "invalid_refresh", "refresh 必须是 0-300 之间的整数秒。");
  }

  return refreshSeconds;
};

export const createApp = (context: AppContext): Hono => {
  const app = new Hono();

  app.onError((error, c) => {
    if (isAppError(error)) {
      return new Response(
        JSON.stringify({
          code: error.status,
          error: error.code,
          message: error.message,
          details: error.details ?? null
        }),
        {
          status: error.status,
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          }
        }
      );
    }

    if (isIlinkApiError(error)) {
      const status = error.category === "retryable" ? 502 : 500;
      return new Response(
        JSON.stringify({
          code: status,
          error: "upstream_error",
          message: error.message,
          details: toErrorDetails(error)
        }),
        {
          status,
          headers: {
            "Content-Type": "application/json; charset=utf-8"
          }
        }
      );
    }

    return new Response(
      JSON.stringify({
        code: 500,
        error: "internal_error",
        message: toErrorMessage(error),
        details: toErrorDetails(error)
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      }
    );
  });

  app.notFound(() =>
    new Response(
      JSON.stringify({
        code: 404,
        error: "not_found",
        message: "Route not found."
      }),
      {
        status: 404,
        headers: {
          "Content-Type": "application/json; charset=utf-8"
        }
      }
    )
  );

  app.use("/admin/*", async (c, next) => {
    const token = extractAdminToken(c.req.raw);
    if (token !== context.config.adminToken) {
      throw new AppError(401, "unauthorized", "缺少有效的 ADMIN_TOKEN。");
    }

    await next();
  });

  app.use("/api/*", async (c, next) => {
    const token = extractBearerToken(c.req.header("Authorization") ?? null);
    if (token !== context.config.adminToken) {
      throw new AppError(401, "unauthorized", "缺少有效的 ADMIN_TOKEN。");
    }

    await next();
  });

  app.use("/webhook/*", async (c, next) => {
    const token = c.req.header("X-Webhook-Token") ?? "";
    if (token !== context.config.webhookSharedToken) {
      throw new AppError(401, "unauthorized", "缺少有效的 X-Webhook-Token。");
    }

    await next();
  });

  app.get("/healthz", async (c) => {
    const data = await context.services.health.probe();
    return c.json({
      code: 200,
      data
    });
  });

  app.get("/admin/dashboard", async (c) => {
    const token = c.req.query("token")?.trim();
    if (!token) {
      throw new AppError(400, "missing_page_token", "总览页需要通过 ?token=ADMIN_TOKEN 打开。");
    }

    const url = new URL(c.req.url);
    const logsLimitRaw = url.searchParams.get("logsLimit");
    let logsLimit = 8;
    if (logsLimitRaw) {
      logsLimit = Number.parseInt(logsLimitRaw, 10);
      if (!Number.isInteger(logsLimit) || logsLimit < 1 || logsLimit > 50) {
        throw new AppError(400, "invalid_logs_limit", "logsLimit 必须是 1-50 之间的整数。");
      }
    }

    return new Response(
      renderDashboardPage({
        adminToken: token,
        refreshSeconds: parseRefreshSeconds(c.req.raw, 5),
        logsLimit
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  });

  app.post("/admin/bot/login/qrcode", async (c) => {
    const data = await context.services.admin.createLoginQrcode();
    return c.json(
      {
        code: 201,
        data
      },
      201
    );
  });

  app.get("/admin/bot/login/qrcode/page", async (c) => {
    const token = c.req.query("token")?.trim();
    if (!token) {
      throw new AppError(400, "missing_page_token", "二维码页面需要通过 ?token=ADMIN_TOKEN 打开。");
    }

    const data = await context.services.admin.createLoginQrcode();
    const svgMarkup = await QRCode.toString(getQrcodeRenderContent(data), {
      type: "svg",
      margin: 1,
      width: 320,
      errorCorrectionLevel: "M",
      color: {
        dark: "#17202d",
        light: "#ffffff"
      }
    });

    return new Response(
      renderQrcodeLoginPage({
        sessionId: data.sessionId,
        expiresAt: data.expiresAt,
        svgMarkup,
        adminToken: token
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  });

  app.get("/admin/bot/login/status/:sessionId", async (c) => {
    const data = await context.services.admin.getLoginStatus(c.req.param("sessionId"));
    return c.json({
      code: 200,
      data
    });
  });

  app.post("/admin/bot/activate", async (c) => {
    const data = await context.services.admin.activateBot();
    return c.json({
      code: 200,
      data
    });
  });

  app.get("/admin/bot/status", async (c) => {
    const data = await context.services.admin.getBotStatus();
    return c.json({
      code: 200,
      data
    });
  });

  app.get("/admin/deliveries", async (c) => {
    const data = await context.services.delivery.listDeliveries(parseDeliveryListQuery(c.req.raw));
    return c.json({
      code: 200,
      data
    });
  });

  app.get("/admin/deliveries/page", async (c) => {
    const token = c.req.query("token")?.trim();
    if (!token) {
      throw new AppError(400, "missing_page_token", "日志页面需要通过 ?token=ADMIN_TOKEN 打开。");
    }

    const filters = parseDeliveryListQuery(c.req.raw);
    return new Response(
      renderDeliveryLogPage({
        adminToken: token,
        initialStatus: filters.status,
        initialSource: filters.source,
        initialLimit: filters.limit,
        initialRefreshSeconds: parseRefreshSeconds(c.req.raw, 5)
      }),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      }
    );
  });

  app.get("/admin/deliveries/:deliveryId", async (c) => {
    const data = await context.services.delivery.getDelivery(c.req.param("deliveryId"));
    if (!data) {
      throw new AppError(404, "delivery_not_found", "未找到对应的投递记录。");
    }

    return c.json({
      code: 200,
      data
    });
  });

  app.post("/api/send", async (c) => {
    const input = validateIncomingMessage(await parseJsonBody(c.req.raw));
    const data = await context.services.delivery.enqueueDelivery("admin", input);
    return c.json(
      {
        code: 202,
        data
      },
      202
    );
  });

  app.post("/webhook/:source", async (c) => {
    const source = validateSource(c.req.param("source"));
    const input = validateIncomingMessage(await parseJsonBody(c.req.raw));
    const data = await context.services.delivery.enqueueDelivery(source, input);
    return c.json(
      {
        code: 202,
        data
      },
      202
    );
  });

  return app;
};
