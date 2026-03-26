import type { BotState } from "../contracts";
import { decryptText, encryptText } from "../lib/crypto";
import { nowIso } from "../lib/time";

interface BotStateRow {
  bot_id: string;
  bot_token_ciphertext: string;
  ilink_user_id_ciphertext: string;
  context_token_ciphertext: string | null;
  get_updates_buf_ciphertext: string | null;
  status: BotState["status"];
  last_error: string | null;
  updated_at: string;
}

export class BotStateRepository {
  public constructor(
    private readonly db: D1Database,
    private readonly encryptionSecret: string
  ) {}

  public async getCurrent(): Promise<BotState | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            bot_id,
            bot_token_ciphertext,
            ilink_user_id_ciphertext,
            context_token_ciphertext,
            get_updates_buf_ciphertext,
            status,
            last_error,
            updated_at
          FROM bot_state
          WHERE singleton_key = 1
        `
      )
      .first<BotStateRow>();

    if (!row) {
      return null;
    }

    return {
      botId: row.bot_id,
      botToken: (await decryptText(this.encryptionSecret, row.bot_token_ciphertext)) ?? "",
      ilinkUserId: (await decryptText(this.encryptionSecret, row.ilink_user_id_ciphertext)) ?? "",
      contextToken: await decryptText(this.encryptionSecret, row.context_token_ciphertext),
      getUpdatesBuf: await decryptText(this.encryptionSecret, row.get_updates_buf_ciphertext),
      status: row.status,
      lastError: row.last_error,
      updatedAt: row.updated_at
    };
  }

  public async saveLoggedInBot(input: {
    botId: string;
    botToken: string;
    ilinkUserId: string;
  }): Promise<void> {
    await this.upsert({
      botId: input.botId,
      botToken: input.botToken,
      ilinkUserId: input.ilinkUserId,
      contextToken: null,
      getUpdatesBuf: null,
      status: "logged_in",
      lastError: null,
      updatedAt: nowIso()
    });
  }

  public async updateActivation(input: {
    contextToken: string | null;
    getUpdatesBuf: string | null;
    status: Extract<BotState["status"], "needs_activation" | "ready">;
    lastError: string | null;
  }): Promise<void> {
    const current = await this.getCurrent();
    if (!current) {
      return;
    }

    await this.upsert({
      ...current,
      contextToken: input.contextToken,
      getUpdatesBuf: input.getUpdatesBuf,
      status: input.status,
      lastError: input.lastError,
      updatedAt: nowIso()
    });
  }

  public async updateStatus(
    status: Extract<BotState["status"], "needs_activation" | "needs_login" | "error" | "ready">,
    lastError: string | null
  ): Promise<void> {
    const current = await this.getCurrent();
    if (!current) {
      return;
    }

    await this.upsert({
      ...current,
      status,
      lastError,
      updatedAt: nowIso()
    });
  }

  public async setLastError(lastError: string | null): Promise<void> {
    const current = await this.getCurrent();
    if (!current) {
      return;
    }

    await this.upsert({
      ...current,
      lastError,
      updatedAt: nowIso()
    });
  }

  private async upsert(state: BotState): Promise<void> {
    await this.db
      .prepare(
        `
          INSERT INTO bot_state (
            singleton_key,
            bot_id,
            bot_token_ciphertext,
            ilink_user_id_ciphertext,
            context_token_ciphertext,
            get_updates_buf_ciphertext,
            status,
            last_error,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(singleton_key) DO UPDATE SET
            bot_id = excluded.bot_id,
            bot_token_ciphertext = excluded.bot_token_ciphertext,
            ilink_user_id_ciphertext = excluded.ilink_user_id_ciphertext,
            context_token_ciphertext = excluded.context_token_ciphertext,
            get_updates_buf_ciphertext = excluded.get_updates_buf_ciphertext,
            status = excluded.status,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `
      )
      .bind(
        1,
        state.botId,
        await encryptText(this.encryptionSecret, state.botToken),
        await encryptText(this.encryptionSecret, state.ilinkUserId),
        await encryptText(this.encryptionSecret, state.contextToken),
        await encryptText(this.encryptionSecret, state.getUpdatesBuf),
        state.status,
        state.lastError,
        state.updatedAt
      )
      .run();
  }
}

