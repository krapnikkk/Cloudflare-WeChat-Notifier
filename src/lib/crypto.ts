import { decodeBase64ToBytes, encodeBytesToBase64 } from "./id";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const importAesKey = async (secret: string): Promise<CryptoKey> => {
  const keyMaterial = encoder.encode(secret);
  const digest = await crypto.subtle.digest("SHA-256", keyMaterial);
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
};

export const encryptText = async (secret: string, plaintext: string | null): Promise<string | null> => {
  if (plaintext === null) {
    return null;
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await importAesKey(secret);
  const encrypted = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    encoder.encode(plaintext)
  );

  return `${encodeBytesToBase64(iv)}.${encodeBytesToBase64(new Uint8Array(encrypted))}`;
};

export const decryptText = async (secret: string, ciphertext: string | null): Promise<string | null> => {
  if (ciphertext === null) {
    return null;
  }

  const [ivBase64, payloadBase64] = ciphertext.split(".");
  if (!ivBase64 || !payloadBase64) {
    throw new Error("Invalid ciphertext payload");
  }

  const key = await importAesKey(secret);
  const iv = decodeBase64ToBytes(ivBase64);
  const payload = decodeBase64ToBytes(payloadBase64);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv
    },
    key,
    payload
  );

  return decoder.decode(decrypted);
};

