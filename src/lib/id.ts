const toBase64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));

const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

export const createSessionId = (): string => crypto.randomUUID();
export const createDeliveryId = (): string => crypto.randomUUID();
export const createTraceId = (): string => crypto.randomUUID();

export const createWechatUin = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const view = new DataView(bytes.buffer);
  const randomNumber = view.getUint32(0, false);
  return btoa(String(randomNumber));
};

export const createIlinkClientId = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  return `openclaw-weixin:${Date.now()}-${toHex(bytes)}`;
};

export const encodeBytesToBase64 = (bytes: Uint8Array): string => toBase64(bytes);
export const decodeBase64ToBytes = (input: string): Uint8Array =>
  Uint8Array.from(atob(input), (value) => value.charCodeAt(0));

