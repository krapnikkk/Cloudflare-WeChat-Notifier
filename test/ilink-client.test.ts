import { afterEach, describe, expect, it, vi } from "vitest";
import { IlinkClient } from "../src/ilink/client";

describe("IlinkClient", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("should call global fetch without triggering illegal invocation", async () => {
    globalThis.fetch = function (this: typeof globalThis, input: RequestInfo | URL, _init?: RequestInit) {
      if (this !== globalThis) {
        throw new TypeError("Illegal invocation");
      }

      expect(String(input)).toContain("/ilink/bot/get_bot_qrcode");
      return Promise.resolve(
        new Response(
          JSON.stringify({
            ret: 0,
            qrcode: "qrcode-token",
            qrcode_img_content: "https://liteapp.weixin.qq.com/q/example"
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json"
            }
          }
        )
      );
    } as typeof fetch;

    const client = new IlinkClient({
      baseUrl: "https://ilinkai.weixin.qq.com"
    });

    await expect(client.getBotQrcode()).resolves.toEqual({
      qrcode: "qrcode-token",
      qrcodeImgContent: "https://liteapp.weixin.qq.com/q/example"
    });
  });
});
