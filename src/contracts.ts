export type BotStatus = "not_logged_in" | "logged_in" | "needs_activation" | "ready" | "needs_login" | "error";
export type LoginSessionStatus = "wait" | "scanned" | "confirmed" | "expired";
export type DeliveryStatus = "queued" | "retrying" | "delivered" | "failed";

export interface BotState {
  botId: string;
  botToken: string;
  ilinkUserId: string;
  contextToken: string | null;
  getUpdatesBuf: string | null;
  status: Exclude<BotStatus, "not_logged_in">;
  lastError: string | null;
  updatedAt: string;
}

export interface BotStatusView {
  status: BotStatus;
  botId: string | null;
  updatedAt: string | null;
  lastError: string | null;
}

export interface LoginSession {
  sessionId: string;
  qrcodeToken: string;
  qrcodeImgContent: string;
  status: LoginSessionStatus;
  expiresAt: string;
  botId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryLog {
  deliveryId: string;
  source: string;
  traceId: string | null;
  dedupeKey: string | null;
  idempotencyKey: string | null;
  text: string;
  meta: Record<string, unknown> | null;
  status: DeliveryStatus;
  attempts: number;
  error: string | null;
  responseCode: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface IncomingMessagePayload {
  text: string;
  traceId?: string;
  dedupeKey?: string;
  meta?: Record<string, unknown>;
}

export interface QueueDeliveryMessage {
  deliveryId: string;
}

export interface LoginQrcodeResponse {
  sessionId: string;
  qrcode: string;
  qrcodeImgContent: string;
  expiresAt: string;
}

export interface LoginStatusResponse {
  sessionId: string;
  status: LoginSessionStatus;
  botId: string | null;
  expiresAt: string;
}

export interface ActivateBotResponse {
  status: BotStatus;
  botId: string | null;
  updatedAt: string | null;
  message: string;
}

export interface EnqueueDeliveryResult {
  deliveryId: string;
  duplicate: boolean;
  status: DeliveryStatus;
}

export interface DeliveryListQuery {
  limit: number;
  status?: DeliveryStatus;
  source?: string;
}

export interface DeliveryListResult {
  items: DeliveryLog[];
  limit: number;
  status?: DeliveryStatus;
  source?: string;
}

export interface QueueProcessResult {
  outcome: "ack" | "retry";
  delaySeconds?: number;
}

export interface HealthResponse {
  service: string;
  timestamp: string;
  database: "ok" | "error";
  queue: "configured" | "missing";
  botStatus: BotStatus;
}

export interface AdminService {
  createLoginQrcode(): Promise<LoginQrcodeResponse>;
  getLoginStatus(sessionId: string): Promise<LoginStatusResponse>;
  activateBot(): Promise<ActivateBotResponse>;
  getBotStatus(): Promise<BotStatusView>;
}

export interface DeliveryService {
  enqueueDelivery(source: string, payload: IncomingMessagePayload): Promise<EnqueueDeliveryResult>;
  listDeliveries(query: DeliveryListQuery): Promise<DeliveryListResult>;
  getDelivery(deliveryId: string): Promise<DeliveryLog | null>;
  processQueuedDelivery(deliveryId: string, attempts: number): Promise<QueueProcessResult>;
  handleQueueProcessingError(deliveryId: string, attempts: number, error: unknown): Promise<QueueProcessResult>;
}

export interface HealthService {
  probe(): Promise<HealthResponse>;
}

export interface RuntimeConfig {
  adminToken: string;
  webhookSharedToken: string;
}

export interface AppServices {
  admin: AdminService;
  delivery: DeliveryService;
  health: HealthService;
}

export interface AppContext {
  config: RuntimeConfig;
  services: AppServices;
}
