import type { DeliveryListQuery, DeliveryListResult, DeliveryLog, EnqueueDeliveryResult, IncomingMessagePayload, QueueProcessResult } from "../contracts";
import { IlinkClient } from "../ilink/client";
import { isIlinkApiError, toErrorMessage } from "../lib/errors";
import { createTraceId } from "../lib/id";
import { BotStateRepository } from "../storage/bot-state-repository";
import { DeliveryLogRepository } from "../storage/delivery-log-repository";

const RETRYABLE_ATTEMPTS = 3;

export class DefaultDeliveryService {
  public constructor(
    private readonly queue: Queue<{ deliveryId: string }>,
    private readonly deliveryLogRepository: DeliveryLogRepository,
    private readonly botRepository: BotStateRepository,
    private readonly ilinkClient: IlinkClient
  ) {}

  public async enqueueDelivery(source: string, payload: IncomingMessagePayload): Promise<EnqueueDeliveryResult> {
    const result = await this.deliveryLogRepository.createQueued({
      source,
      traceId: payload.traceId ?? createTraceId(),
      dedupeKey: payload.dedupeKey ?? null,
      text: payload.text,
      meta: payload.meta ?? null
    });

    if (result.duplicate) {
      return {
        deliveryId: result.delivery.deliveryId,
        duplicate: true,
        status: result.delivery.status
      };
    }

    try {
      await this.queue.send(
        {
          deliveryId: result.delivery.deliveryId
        },
        {
          contentType: "json"
        }
      );
    } catch (error) {
      const message = `消息入队失败: ${toErrorMessage(error)}`;
      await this.deliveryLogRepository.markFailed(result.delivery.deliveryId, 0, message, null);
      throw error;
    }

    return {
      deliveryId: result.delivery.deliveryId,
      duplicate: false,
      status: "queued"
    };
  }

  public async listDeliveries(query: DeliveryListQuery): Promise<DeliveryListResult> {
    const items = await this.deliveryLogRepository.list(query);
    return {
      items,
      limit: query.limit,
      status: query.status,
      source: query.source
    };
  }

  public async getDelivery(deliveryId: string): Promise<DeliveryLog | null> {
    return this.deliveryLogRepository.getById(deliveryId);
  }

  public async processQueuedDelivery(deliveryId: string, attempts: number): Promise<QueueProcessResult> {
    const delivery = await this.deliveryLogRepository.getById(deliveryId);
    if (!delivery) {
      return {
        outcome: "ack"
      };
    }

    const bot = await this.botRepository.getCurrent();
    if (!bot) {
      await this.deliveryLogRepository.markFailed(deliveryId, attempts, "未找到已登录 bot，请重新登录。", null);
      return {
        outcome: "ack"
      };
    }

    if (!bot.contextToken || bot.status === "logged_in" || bot.status === "needs_activation") {
      const message = "bot 尚未激活，请先调用 /admin/bot/activate。";
      await this.botRepository.updateStatus("needs_activation", message);
      await this.deliveryLogRepository.markFailed(deliveryId, attempts, message, null);
      return {
        outcome: "ack"
      };
    }

    try {
      await this.ilinkClient.sendMessage(bot, delivery.text);
      await this.botRepository.setLastError(null);
      await this.deliveryLogRepository.markDelivered(deliveryId, attempts, 200);
      return {
        outcome: "ack"
      };
    } catch (error) {
      const message = toErrorMessage(error);
      if (isIlinkApiError(error)) {
        if (error.category === "retryable" && attempts <= RETRYABLE_ATTEMPTS) {
          await this.deliveryLogRepository.markRetrying(deliveryId, attempts, message, error.httpStatus ?? null);
          return {
            outcome: "retry",
            delaySeconds: attempts * 5
          };
        }

        if (error.category === "unauthorized") {
          await this.botRepository.updateStatus("needs_login", message);
        } else if (error.category === "context") {
          await this.botRepository.updateStatus("needs_activation", message);
        } else {
          await this.botRepository.setLastError(message);
        }

        await this.deliveryLogRepository.markFailed(deliveryId, attempts, message, error.httpStatus ?? null);
        return {
          outcome: "ack"
        };
      }

      if (attempts <= RETRYABLE_ATTEMPTS) {
        await this.deliveryLogRepository.markRetrying(deliveryId, attempts, message, null);
        return {
          outcome: "retry",
          delaySeconds: attempts * 5
        };
      }

      await this.botRepository.setLastError(message);
      await this.deliveryLogRepository.markFailed(deliveryId, attempts, message, null);
      return {
        outcome: "ack"
      };
    }
  }

  public async handleQueueProcessingError(deliveryId: string, attempts: number, error: unknown): Promise<QueueProcessResult> {
    const message = `队列处理异常: ${toErrorMessage(error)}`;

    try {
      const delivery = await this.deliveryLogRepository.getById(deliveryId);
      if (!delivery) {
        return {
          outcome: "ack"
        };
      }

      if (attempts <= RETRYABLE_ATTEMPTS) {
        await this.deliveryLogRepository.markRetrying(deliveryId, attempts, message, null);
        return {
          outcome: "retry",
          delaySeconds: Math.max(attempts, 1) * 5
        };
      }

      await this.deliveryLogRepository.markFailed(deliveryId, attempts, message, null);
      return {
        outcome: "ack"
      };
    } catch {
      return attempts <= RETRYABLE_ATTEMPTS
        ? {
            outcome: "retry",
            delaySeconds: Math.max(attempts, 1) * 5
          }
        : {
            outcome: "ack"
          };
    }
  }
}
