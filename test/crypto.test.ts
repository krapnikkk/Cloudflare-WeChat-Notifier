import { describe, expect, it } from "vitest";
import { decryptText, encryptText } from "../src/lib/crypto";

describe("crypto helpers", () => {
  it("should encrypt and decrypt text", async () => {
    const secret = "worker-secret-key";
    const ciphertext = await encryptText(secret, "hello ilink");

    expect(ciphertext).not.toBeNull();
    expect(ciphertext).not.toBe("hello ilink");
    await expect(decryptText(secret, ciphertext)).resolves.toBe("hello ilink");
  });

  it("should preserve null values", async () => {
    await expect(encryptText("worker-secret-key", null)).resolves.toBeNull();
    await expect(decryptText("worker-secret-key", null)).resolves.toBeNull();
  });
});

