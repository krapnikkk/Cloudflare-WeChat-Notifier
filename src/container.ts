import type { AppContext } from "./contracts";
import type { CloudflareBindings } from "./bindings";
import { IlinkClient } from "./ilink/client";
import { AppError } from "./lib/errors";
import { DefaultAdminService } from "./services/admin-service";
import { DefaultDeliveryService } from "./services/delivery-service";
import { DefaultHealthService } from "./services/health-service";
import { BotStateRepository } from "./storage/bot-state-repository";
import { DeliveryLogRepository } from "./storage/delivery-log-repository";
import { LoginSessionRepository } from "./storage/login-session-repository";

const requireBinding = (value: string | undefined, name: string): string => {
  if (!value) {
    throw new AppError(500, "missing_binding", `缺少必需绑定: ${name}`);
  }

  return value;
};

export const createAppContext = (env: CloudflareBindings): AppContext => {
  const adminToken = requireBinding(env.ADMIN_TOKEN, "ADMIN_TOKEN");
  const webhookSharedToken = requireBinding(env.WEBHOOK_SHARED_TOKEN, "WEBHOOK_SHARED_TOKEN");
  const encryptionSecret = requireBinding(env.BOT_STATE_ENC_KEY, "BOT_STATE_ENC_KEY");

  const botRepository = new BotStateRepository(env.DB, encryptionSecret);
  const loginSessionRepository = new LoginSessionRepository(env.DB);
  const deliveryLogRepository = new DeliveryLogRepository(env.DB);
  const ilinkClient = new IlinkClient({
    baseUrl: env.ILINK_BASE_URL
  });

  return {
    config: {
      adminToken,
      webhookSharedToken
    },
    services: {
      admin: new DefaultAdminService(ilinkClient, botRepository, loginSessionRepository),
      delivery: new DefaultDeliveryService(env.NOTIFICATION_QUEUE, deliveryLogRepository, botRepository, ilinkClient),
      health: new DefaultHealthService(env.DB, env.NOTIFICATION_QUEUE, botRepository)
    }
  };
};

