import type { BotState } from "../contracts";
import { IlinkApiError, toErrorMessage } from "../lib/errors";
import { createIlinkClientId, createWechatUin } from "../lib/id";

const DEFAULT_BASE_URL = "https://ilinkai.weixin.qq.com";

interface IlinkClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface IlinkApiBaseResponse {
  ret?: number;
  errcode?: number;
  errmsg?: string;
  err_msg?: string;
  error?: string;
}

interface GetBotQrcodeResponse {
  qrcode: string;
  qrcode_img_content: string;
}

interface GetQrcodeStatusResponse {
  status: "wait" | "scaned" | "confirmed" | "expired";
  bot_token?: string;
  ilink_bot_id?: string;
  ilink_user_id?: string;
}

interface MessageItem {
  type: number;
  text_item?: {
    text?: string;
  };
}

interface UpdateMessage {
  from_user_id?: string;
  context_token?: string;
  item_list?: MessageItem[];
}

interface GetUpdatesResponse extends IlinkApiBaseResponse {
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
  msgs?: UpdateMessage[];
}

interface SendMessageResponse extends IlinkApiBaseResponse {}
interface SendTypingResponse extends IlinkApiBaseResponse {}
interface GetConfigResponse extends IlinkApiBaseResponse {
  typing_ticket?: string;
}

const readErrorMessage = (responseBody: Record<string, unknown>): string => {
  const values = [responseBody.error, responseBody.errmsg, responseBody.err_msg]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .map((value) => value.trim());

  return values[0] ?? "iLink API request failed";
};

const classifyErrorCategory = (
  httpStatus: number | undefined,
  message: string
): "unauthorized" | "context" | "retryable" | "unknown" => {
  const normalized = message.toLowerCase();

  if (httpStatus === 401 || httpStatus === 403 || normalized.includes("unauthorized") || normalized.includes("token")) {
    return "unauthorized";
  }

  if (normalized.includes("context")) {
    return "context";
  }

  if ((httpStatus !== undefined && httpStatus >= 500) || normalized.includes("timeout")) {
    return "retryable";
  }

  return "unknown";
};

export class IlinkClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  public constructor(options: IlinkClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    // Cloudflare Workers 的原生 fetch 依赖正确的调用上下文。
    // 这里用箭头函数包一层，避免作为对象属性调用时触发 Illegal invocation。
    this.fetchImpl = options.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => globalThis.fetch(input, init));
  }

  public async getBotQrcode(): Promise<{ qrcode: string; qrcodeImgContent: string }> {
    const response = await this.request<GetBotQrcodeResponse>("GET", "/ilink/bot/get_bot_qrcode?bot_type=3", {
      extraHeaders: {
        "iLink-App-ClientVersion": "1"
      }
    });

    return {
      qrcode: response.qrcode,
      qrcodeImgContent: response.qrcode_img_content
    };
  }

  public async getQrcodeStatus(qrcode: string): Promise<{
    status: "wait" | "scanned" | "confirmed" | "expired";
    botToken: string | null;
    botId: string | null;
    ilinkUserId: string | null;
  }> {
    const encodedQrcode = encodeURIComponent(qrcode);
    const response = await this.request<GetQrcodeStatusResponse>(
      "GET",
      `/ilink/bot/get_qrcode_status?qrcode=${encodedQrcode}`,
      {
        extraHeaders: {
          "iLink-App-ClientVersion": "1"
        }
      }
    );

    return {
      status: response.status === "scaned" ? "scanned" : response.status,
      botToken: response.bot_token ?? null,
      botId: response.ilink_bot_id ?? null,
      ilinkUserId: response.ilink_user_id ?? null
    };
  }

  public async getUpdates(bot: BotState): Promise<{ getUpdatesBuf: string | null; messages: UpdateMessage[] }> {
    const response = await this.request<GetUpdatesResponse>("POST", "/ilink/bot/getupdates", {
      token: bot.botToken,
      body: {
        get_updates_buf: bot.getUpdatesBuf ?? "",
        base_info: {
          channel_version: "1.0.0"
        }
      }
    });

    this.assertIlinkBody(response, 200, `${this.baseUrl}/ilink/bot/getupdates`);

    return {
      getUpdatesBuf: response.get_updates_buf ?? null,
      messages: response.msgs ?? []
    };
  }

  public async sendMessage(bot: BotState, text: string): Promise<void> {
    const response = await this.request<SendMessageResponse>("POST", "/ilink/bot/sendmessage", {
      token: bot.botToken,
      body: {
        msg: {
          from_user_id: "",
          to_user_id: bot.ilinkUserId,
          client_id: createIlinkClientId(),
          message_type: 2,
          message_state: 2,
          context_token: bot.contextToken,
          item_list: [
            {
              type: 1,
              text_item: {
                text
              }
            }
          ]
        },
        base_info: {
          channel_version: "1.0.2"
        }
      }
    });

    this.assertIlinkBody(response, 200, `${this.baseUrl}/ilink/bot/sendmessage`);
  }

  public async sendTyping(bot: BotState, status: 1 | 2): Promise<void> {
    const config = await this.request<GetConfigResponse>("POST", "/ilink/bot/getconfig", {
      token: bot.botToken,
      body: {
        ilink_user_id: bot.ilinkUserId,
        context_token: bot.contextToken,
        base_info: {
          channel_version: "1.0.0"
        }
      }
    });

    this.assertIlinkBody(config, 200, `${this.baseUrl}/ilink/bot/getconfig`);

    const response = await this.request<SendTypingResponse>("POST", "/ilink/bot/sendtyping", {
      token: bot.botToken,
      body: {
        ilink_user_id: bot.ilinkUserId,
        typing_ticket: config.typing_ticket,
        status,
        base_info: {
          channel_version: "1.0.0"
        }
      }
    });

    this.assertIlinkBody(response, 200, `${this.baseUrl}/ilink/bot/sendtyping`);
  }

  private async request<T extends object>(
    method: "GET" | "POST",
    path: string,
    options: {
      token?: string;
      body?: Record<string, unknown>;
      extraHeaders?: Record<string, string>;
    } = {}
  ): Promise<T> {
    const upstreamUrl = `${this.baseUrl}${path}`;
    const headers = new Headers(options.extraHeaders);
    headers.set("AuthorizationType", "ilink_bot_token");
    headers.set("X-WECHAT-UIN", createWechatUin());

    if (options.token) {
      headers.set("Authorization", `Bearer ${options.token}`);
    }

    let body: string | undefined;
    if (options.body) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(options.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(upstreamUrl, {
        method,
        headers,
        body
      });
    } catch (error) {
      console.error("[iLink] network failure", {
        upstreamUrl,
        method,
        error: error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              cause: error.cause
            }
          : error
      });

      throw new IlinkApiError(`iLink API network failure: ${toErrorMessage(error)}`, {
        category: "retryable",
        upstreamUrl,
        cause: error
      });
    }

    const text = await response.text();
    const parsed = text ? this.safeParseJson(text) : {};

    if (!response.ok) {
      const message = readErrorMessage(parsed);
      throw new IlinkApiError(message, {
        category: classifyErrorCategory(response.status, message),
        httpStatus: response.status,
        upstreamUrl
      });
    }

    return parsed as T;
  }

  private assertIlinkBody(response: IlinkApiBaseResponse, httpStatus: number, upstreamUrl: string): void {
    const ret = response.ret ?? 0;
    const errcode = response.errcode ?? 0;
    if (ret === 0 && errcode === 0) {
      return;
    }

    const message = response.errmsg ?? response.err_msg ?? response.error ?? `iLink ret=${ret} errcode=${errcode}`;
    throw new IlinkApiError(message, {
      category: classifyErrorCategory(httpStatus, message),
      httpStatus,
      ret,
      errcode,
      upstreamUrl
    });
  }

  private safeParseJson(input: string): Record<string, unknown> {
    try {
      return JSON.parse(input) as Record<string, unknown>;
    } catch {
      return {
        error: input
      };
    }
  }
}
