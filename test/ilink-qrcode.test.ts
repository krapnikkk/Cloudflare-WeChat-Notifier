import { describe, expect, it } from "vitest";
import { getQrcodeRenderContent } from "../src/lib/ilink-qrcode";

describe("iLink qrcode rendering", () => {
  it("should use qrcodeImgContent as the actual scannable payload", () => {
    expect(
      getQrcodeRenderContent({
        sessionId: "session-1",
        qrcode: "token-only-value",
        qrcodeImgContent: "https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3",
        expiresAt: "2026-03-26T00:00:00.000Z"
      })
    ).toBe("https://liteapp.weixin.qq.com/q/7GiQu1?qrcode=abc&bot_type=3");
  });
});
