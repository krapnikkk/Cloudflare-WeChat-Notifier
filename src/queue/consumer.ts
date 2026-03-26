import type { AppContext, QueueDeliveryMessage } from "../contracts";

export const handleQueueBatch = async (batch: MessageBatch<QueueDeliveryMessage>, context: AppContext): Promise<void> => {
  for (const message of batch.messages) {
    const deliveryId = message.body?.deliveryId;
    if (!deliveryId) {
      message.ack();
      continue;
    }

    const result = await context.services.delivery.processQueuedDelivery(deliveryId, message.attempts);
    if (result.outcome === "retry") {
      message.retry(result.delaySeconds ? { delaySeconds: result.delaySeconds } : undefined);
      continue;
    }

    message.ack();
  }
};

