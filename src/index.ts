import type { CloudflareBindings } from "./bindings";
import { createApp } from "./app";
import { createAppContext } from "./container";
import { isAppError, isIlinkApiError, toErrorDetails, toErrorMessage } from "./lib/errors";
import { handleQueueBatch } from "./queue/consumer";

const toFailureResponse = (error: unknown): Response => {
  const status = isAppError(error) ? error.status : isIlinkApiError(error) ? 502 : 500;
  const code = isAppError(error) ? error.code : isIlinkApiError(error) ? "upstream_error" : "internal_error";
  const message = toErrorMessage(error);

  return Response.json(
    {
      code: status,
      error: code,
      message,
      details: toErrorDetails(error)
    },
    {
      status
    }
  );
};

export default {
  async fetch(request, env, executionContext): Promise<Response> {
    try {
      const context = createAppContext(env as CloudflareBindings);
      const app = createApp(context);
      return app.fetch(request, env, executionContext);
    } catch (error) {
      return toFailureResponse(error);
    }
  },

  async queue(batch, env): Promise<void> {
    const context = createAppContext(env as CloudflareBindings);
    await handleQueueBatch(batch as MessageBatch<{ deliveryId: string }>, context);
  }
} satisfies ExportedHandler<CloudflareBindings>;
