import { describe, expect, it, vi } from "vitest";
import { handleQueueBatch } from "../src/queue/consumer";
import type { AppContext, AppServices, QueueDeliveryMessage } from "../src/contracts";

const createServices = (outcome: "ack" | "retry"): AppServices => ({
  admin: {
    createLoginQrcode: vi.fn(),
    getLoginStatus: vi.fn(),
    activateBot: vi.fn(),
    getBotStatus: vi.fn()
  },
  delivery: {
    enqueueDelivery: vi.fn(),
    listDeliveries: vi.fn(),
    getDelivery: vi.fn(),
    processQueuedDelivery: vi.fn().mockResolvedValue(
      outcome === "retry"
        ? {
            outcome: "retry",
            delaySeconds: 10
          }
        : {
            outcome: "ack"
          }
    )
  },
  health: {
    probe: vi.fn()
  }
});

const createContext = (outcome: "ack" | "retry"): AppContext => ({
  config: {
    adminToken: "admin-token",
    webhookSharedToken: "webhook-token"
  },
  services: createServices(outcome)
});

const createMessage = (body: QueueDeliveryMessage, attempts = 1) => {
  const state = {
    acked: false,
    retried: false,
    retryOptions: undefined as QueueRetryOptions | undefined
  };

  const message = {
    id: "msg-1",
    timestamp: new Date(),
    body,
    attempts,
    ack: () => {
      state.acked = true;
    },
    retry: (options?: QueueRetryOptions) => {
      state.retried = true;
      state.retryOptions = options;
    }
  } as unknown as Message<QueueDeliveryMessage>;

  return {
    message,
    state
  };
};

describe("queue consumer", () => {
  it("should ack messages on success", async () => {
    const context = createContext("ack");
    const { message, state } = createMessage({ deliveryId: "delivery-1" });

    const batch = {
      queue: "ilink-notification-queue",
      messages: [message]
    } as unknown as MessageBatch<QueueDeliveryMessage>;

    await handleQueueBatch(batch, context);

    expect(state.acked).toBe(true);
    expect(state.retried).toBe(false);
    expect(context.services.delivery.processQueuedDelivery).toHaveBeenCalledWith("delivery-1", 1);
  });

  it("should retry messages when the service asks for retry", async () => {
    const context = createContext("retry");
    const { message, state } = createMessage({ deliveryId: "delivery-1" }, 2);

    const batch = {
      queue: "ilink-notification-queue",
      messages: [message]
    } as unknown as MessageBatch<QueueDeliveryMessage>;

    await handleQueueBatch(batch, context);

    expect(state.acked).toBe(false);
    expect(state.retried).toBe(true);
    expect(state.retryOptions).toEqual({
      delaySeconds: 10
    });
  });
});
