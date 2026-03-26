import type { DeliveryLog, DeliveryStatus } from "../contracts";
import { createDeliveryId } from "../lib/id";
import { nowIso } from "../lib/time";

interface DeliveryLogRow {
  delivery_id: string;
  source: string;
  trace_id: string | null;
  dedupe_key: string | null;
  idempotency_key: string | null;
  text: string;
  meta_json: string | null;
  status: DeliveryStatus;
  attempts: number;
  error: string | null;
  response_code: number | null;
  created_at: string;
  updated_at: string;
}

const parseMeta = (raw: string | null): Record<string, unknown> | null => {
  if (!raw) {
    return null;
  }

  return JSON.parse(raw) as Record<string, unknown>;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("UNIQUE constraint failed: delivery_log.idempotency_key");

export class DeliveryLogRepository {
  public constructor(private readonly db: D1Database) {}

  public async createQueued(input: {
    source: string;
    traceId: string;
    dedupeKey: string | null;
    text: string;
    meta: Record<string, unknown> | null;
  }): Promise<{ delivery: DeliveryLog; duplicate: boolean }> {
    const deliveryId = createDeliveryId();
    const idempotencyKey = input.dedupeKey ? `${input.source}:${input.dedupeKey}` : null;
    const now = nowIso();

    try {
      await this.db
        .prepare(
          `
            INSERT INTO delivery_log (
              delivery_id,
              source,
              trace_id,
              dedupe_key,
              idempotency_key,
              text,
              meta_json,
              status,
              attempts,
              error,
              response_code,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', 0, NULL, NULL, ?, ?)
          `
        )
        .bind(
          deliveryId,
          input.source,
          input.traceId,
          input.dedupeKey,
          idempotencyKey,
          input.text,
          input.meta ? JSON.stringify(input.meta) : null,
          now,
          now
        )
        .run();
    } catch (error) {
      if (!idempotencyKey || !isUniqueConstraintError(error)) {
        throw error;
      }

      const existing = await this.getByIdempotencyKey(idempotencyKey);
      if (!existing) {
        throw error;
      }

      return {
        delivery: existing,
        duplicate: true
      };
    }

    const created = await this.getById(deliveryId);
    if (!created) {
      throw new Error("Failed to read queued delivery");
    }

    return {
      delivery: created,
      duplicate: false
    };
  }

  public async getById(deliveryId: string): Promise<DeliveryLog | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            delivery_id,
            source,
            trace_id,
            dedupe_key,
            idempotency_key,
            text,
            meta_json,
            status,
            attempts,
            error,
            response_code,
            created_at,
            updated_at
          FROM delivery_log
          WHERE delivery_id = ?
        `
      )
      .bind(deliveryId)
      .first<DeliveryLogRow>();

    return row ? this.toEntity(row) : null;
  }

  public async list(input: {
    limit: number;
    status?: DeliveryStatus;
    source?: string;
  }): Promise<DeliveryLog[]> {
    const filters: string[] = [];
    const bindings: Array<string | number> = [];

    if (input.status) {
      filters.push("status = ?");
      bindings.push(input.status);
    }

    if (input.source) {
      filters.push("source = ?");
      bindings.push(input.source);
    }

    const whereClause = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    const statement = this.db
      .prepare(
        `
          SELECT
            delivery_id,
            source,
            trace_id,
            dedupe_key,
            idempotency_key,
            text,
            meta_json,
            status,
            attempts,
            error,
            response_code,
            created_at,
            updated_at
          FROM delivery_log
          ${whereClause}
          ORDER BY created_at DESC, delivery_id DESC
          LIMIT ?
        `
      )
      .bind(...bindings, input.limit);

    const result = await statement.all<DeliveryLogRow>();
    return result.results.map((row) => this.toEntity(row));
  }

  public async markRetrying(deliveryId: string, attempts: number, error: string, responseCode: number | null): Promise<void> {
    await this.update(deliveryId, "retrying", attempts, error, responseCode);
  }

  public async markDelivered(deliveryId: string, attempts: number, responseCode: number | null): Promise<void> {
    await this.update(deliveryId, "delivered", attempts, null, responseCode);
  }

  public async markFailed(deliveryId: string, attempts: number, error: string, responseCode: number | null): Promise<void> {
    await this.update(deliveryId, "failed", attempts, error, responseCode);
  }

  private async getByIdempotencyKey(idempotencyKey: string): Promise<DeliveryLog | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            delivery_id,
            source,
            trace_id,
            dedupe_key,
            idempotency_key,
            text,
            meta_json,
            status,
            attempts,
            error,
            response_code,
            created_at,
            updated_at
          FROM delivery_log
          WHERE idempotency_key = ?
        `
      )
      .bind(idempotencyKey)
      .first<DeliveryLogRow>();

    return row ? this.toEntity(row) : null;
  }

  private async update(
    deliveryId: string,
    status: DeliveryStatus,
    attempts: number,
    error: string | null,
    responseCode: number | null
  ): Promise<void> {
    await this.db
      .prepare(
        `
          UPDATE delivery_log
          SET status = ?, attempts = ?, error = ?, response_code = ?, updated_at = ?
          WHERE delivery_id = ?
        `
      )
      .bind(status, attempts, error, responseCode, nowIso(), deliveryId)
      .run();
  }

  private toEntity(row: DeliveryLogRow): DeliveryLog {
    return {
      deliveryId: row.delivery_id,
      source: row.source,
      traceId: row.trace_id,
      dedupeKey: row.dedupe_key,
      idempotencyKey: row.idempotency_key,
      text: row.text,
      meta: parseMeta(row.meta_json),
      status: row.status,
      attempts: row.attempts,
      error: row.error,
      responseCode: row.response_code,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
