import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { AppContext, AppServices } from "../src/contracts";
import { IlinkApiError } from "../src/lib/errors";

const createServices = (): AppServices => ({
  admin: {
    createLoginQrcode: vi.fn().mockResolvedValue({
      sessionId: "session-1",
      qrcode: "qrcode-token",
      qrcodeImgContent: "data:image/png;base64,abc",
      expiresAt: "2026-03-26T00:00:00.000Z"
    }),
    getLoginStatus: vi.fn().mockResolvedValue({
      sessionId: "session-1",
      status: "wait",
      botId: null,
      expiresAt: "2026-03-26T00:00:00.000Z"
    }),
    activateBot: vi.fn().mockResolvedValue({
      status: "needs_activation",
      botId: "bot-1",
      updatedAt: "2026-03-26T00:00:00.000Z",
      message: "need activation"
    }),
    getBotStatus: vi.fn().mockResolvedValue({
      status: "ready",
      botId: "bot-1",
      updatedAt: "2026-03-26T00:00:00.000Z",
      lastError: null
    })
  },
  delivery: {
    enqueueDelivery: vi.fn().mockResolvedValue({
      deliveryId: "delivery-1",
      duplicate: false,
      status: "queued"
    }),
    listDeliveries: vi.fn().mockResolvedValue({
      items: [
        {
          deliveryId: "delivery-1",
          source: "github",
          traceId: "trace-1",
          dedupeKey: "build-1",
          idempotencyKey: "github:build-1",
          text: "build completed",
          meta: {
            env: "prod"
          },
          status: "delivered",
          attempts: 1,
          error: null,
          responseCode: 200,
          createdAt: "2026-03-26T00:00:00.000Z",
          updatedAt: "2026-03-26T00:00:00.000Z"
        }
      ],
      limit: 20,
      status: undefined,
      source: undefined
    }),
    getDelivery: vi.fn().mockResolvedValue({
      deliveryId: "delivery-1",
      source: "github",
      traceId: "trace-1",
      dedupeKey: "build-1",
      idempotencyKey: "github:build-1",
      text: "build completed",
      meta: {
        env: "prod"
      },
      status: "delivered",
      attempts: 1,
      error: null,
      responseCode: 200,
      createdAt: "2026-03-26T00:00:00.000Z",
      updatedAt: "2026-03-26T00:00:00.000Z"
    }),
    processQueuedDelivery: vi.fn().mockResolvedValue({
      outcome: "ack"
    }),
    handleQueueProcessingError: vi.fn().mockResolvedValue({
      outcome: "ack"
    })
  },
  health: {
    probe: vi.fn().mockResolvedValue({
      service: "ilink-cloudflare",
      timestamp: "2026-03-26T00:00:00.000Z",
      database: "ok",
      queue: "configured",
      botStatus: "ready"
    })
  }
});

const createContext = (): AppContext => ({
  config: {
    adminToken: "admin-token",
    webhookSharedToken: "webhook-token"
  },
  services: createServices()
});

describe("app routes", () => {
  it("should return health status", async () => {
    const app = createApp(createContext());
    const response = await app.request("http://localhost/healthz");
    const body = (await response.json()) as { code: number; data: { service: string } };

    expect(response.status).toBe(200);
    expect(body.code).toBe(200);
    expect(body.data.service).toBe("ilink-cloudflare");
  });

  it("should reject admin routes without bearer token", async () => {
    const app = createApp(createContext());
    const response = await app.request("http://localhost/admin/bot/status");
    const body = (await response.json()) as { code: number; error: string };

    expect(response.status).toBe(401);
    expect(body.error).toBe("unauthorized");
  });

  it("should accept webhook requests with shared token", async () => {
    const context = createContext();
    const app = createApp(context);

    const response = await app.request("http://localhost/webhook/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": "webhook-token"
      },
      body: JSON.stringify({
        text: "build completed",
        dedupeKey: "build-1"
      })
    });

    const body = (await response.json()) as { code: number; data: { deliveryId: string } };

    expect(response.status).toBe(202);
    expect(body.data.deliveryId).toBe("delivery-1");
    expect(context.services.delivery.enqueueDelivery).toHaveBeenCalledWith("github", {
      text: "build completed",
      dedupeKey: "build-1",
      traceId: undefined,
      meta: undefined
    });
  });

  it("should reject invalid webhook payloads", async () => {
    const app = createApp(createContext());

    const response = await app.request("http://localhost/webhook/github", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Token": "webhook-token"
      },
      body: JSON.stringify({
        text: ""
      })
    });

    const body = (await response.json()) as { code: number; error: string };
    expect(response.status).toBe(400);
    expect(body.error).toBe("missing_text");
  });

  it("should render qrcode page via query token", async () => {
    const app = createApp(createContext());
    const response = await app.request("http://localhost/admin/bot/login/qrcode/page?token=admin-token");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("<svg");
    expect(body).toContain("session-1");
  });

  it("should render dashboard page via query token", async () => {
    const app = createApp(createContext());
    const response = await app.request("http://localhost/admin/dashboard?token=admin-token&refresh=10&logsLimit=12");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("iLink 管理总览");
    expect(body).toContain("手动发送测试");
    expect(body).toContain("10");
    expect(body).toContain("12");
  });

  it("should list deliveries", async () => {
    const context = createContext();
    const app = createApp(context);

    const response = await app.request("http://localhost/admin/deliveries?token=admin-token&limit=10&status=delivered");
    const body = (await response.json()) as { code: number; data: { items: Array<{ deliveryId: string }> } };

    expect(response.status).toBe(200);
    expect(body.data.items[0]?.deliveryId).toBe("delivery-1");
    expect(context.services.delivery.listDeliveries).toHaveBeenCalledWith({
      limit: 10,
      status: "delivered",
      source: undefined
    });
  });

  it("should render delivery log page via query token", async () => {
    const app = createApp(createContext());
    const response = await app.request(
      "http://localhost/admin/deliveries/page?token=admin-token&status=failed&source=github&limit=50&refresh=10"
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(body).toContain("投递日志中心");
    expect(body).toContain("failed");
    expect(body).toContain("github");
    expect(body).toContain("10");
  });

  it("should return upstream diagnostics for ilink network failures", async () => {
    const context = createContext();
    context.services.admin.createLoginQrcode = vi.fn().mockRejectedValue(
      new IlinkApiError("iLink API network failure: fetch failed", {
        category: "retryable",
        upstreamUrl: "https://ilinkai.weixin.qq.com/ilink/bot/get_bot_qrcode?bot_type=3",
        cause: new Error("fetch failed")
      })
    );

    const app = createApp(context);
    const response = await app.request("http://localhost/admin/bot/login/qrcode", {
      method: "POST",
      headers: {
        Authorization: "Bearer admin-token"
      }
    });
    const body = (await response.json()) as {
      code: number;
      error: string;
      message: string;
      details: { category: string; upstreamUrl: string };
    };

    expect(response.status).toBe(502);
    expect(body.error).toBe("upstream_error");
    expect(body.details.category).toBe("retryable");
    expect(body.details.upstreamUrl).toContain("/ilink/bot/get_bot_qrcode");
  });
});
