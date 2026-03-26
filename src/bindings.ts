import type { QueueDeliveryMessage } from "./contracts";

export interface CloudflareBindings {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue<QueueDeliveryMessage>;
  ADMIN_TOKEN: string;
  WEBHOOK_SHARED_TOKEN: string;
  BOT_STATE_ENC_KEY: string;
  ILINK_BASE_URL?: string;
}

