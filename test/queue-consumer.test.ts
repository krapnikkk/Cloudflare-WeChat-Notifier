import { describe, expect, it, vi } from "vitest";
import { handleQueueBatch } from "../src/queue/consumer";
import type { AppContext, AppServices, QueueDeliveryMessage } from "../src/contracts";

const createServices = (outcome: "ack" | "retry", options?: {
  throwOnDeliveryIds?: string[];
  fallbackOutcome?: "ack" | "retry";
}): AppServices => {
  const throwOnDeliveryIds = new Set(options?.throwOnDeliveryIds ?? []);

  return {
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
      processQueuedDelivery: vi.fn().mockImplementation(async (deliveryId: string) => {
        if (throwOnDeliveryIds.has(deliveryId)) {
          throw new Error("unexpected processing error");
        }

        return outcome === "retry"
          ? {
              outcome: "retry" as const,
              delaySeconds: 10
            }
          : {
              outcome: "ack" as const
            };
      }),
      handleQueueProcessingError: vi.fn().mockResolvedValue(
        options?.fallbackOutcome === "retry"
          ? {
              outcome: "retry",
              delaySeconds: 5
            }
          : {
              outcome: "ack"
            }
      )
    },
    health: {
      probe: vi.fn()
    }
  };
};

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

  it("should handle unexpected errors per message and continue the batch", async () => {
    const context = {
      config: {
        adminToken: "admin-token",
        webhookSharedToken: "webhook-token"
      },
      services: createServices("ack", {
        throwOnDeliveryIds: ["delivery-1"],
        fallbackOutcome: "retry"
      })
    } satisfies AppContext;

    const first = createMessage({ deliveryId: "delivery-1" }, 0);
    const second = createMessage({ deliveryId: "delivery-2" }, 1);

    const batch = {
      queue: "ilink-notification-queue",
      messages: [first.message, second.message]
    } as unknown as MessageBatch<QueueDeliveryMessage>;

    await handleQueueBatch(batch, context);

    expect(context.services.delivery.handleQueueProcessingError).toHaveBeenCalledWith(
      "delivery-1",
      0,
      expect.any(Error)
    );
    expect(first.state.retried).toBe(true);
    expect(first.state.retryOptions).toEqual({
      delaySeconds: 5
    });
    expect(second.state.acked).toBe(true);
    expect(context.services.delivery.processQueuedDelivery).toHaveBeenNthCalledWith(2, "delivery-2", 1);
  });
});
