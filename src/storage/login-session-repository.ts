import type { LoginSession, LoginSessionStatus } from "../contracts";

interface LoginSessionRow {
  session_id: string;
  qrcode_token: string;
  qrcode_img_content: string;
  status: LoginSessionStatus;
  expires_at: string;
  bot_id: string | null;
  created_at: string;
  updated_at: string;
}

export class LoginSessionRepository {
  public constructor(private readonly db: D1Database) {}

  public async create(session: LoginSession): Promise<void> {
    await this.db
      .prepare(
        `
          INSERT INTO login_session (
            session_id,
            qrcode_token,
            qrcode_img_content,
            status,
            expires_at,
            bot_id,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
      )
      .bind(
        session.sessionId,
        session.qrcodeToken,
        session.qrcodeImgContent,
        session.status,
        session.expiresAt,
        session.botId,
        session.createdAt,
        session.updatedAt
      )
      .run();
  }

  public async getById(sessionId: string): Promise<LoginSession | null> {
    const row = await this.db
      .prepare(
        `
          SELECT
            session_id,
            qrcode_token,
            qrcode_img_content,
            status,
            expires_at,
            bot_id,
            created_at,
            updated_at
          FROM login_session
          WHERE session_id = ?
        `
      )
      .bind(sessionId)
      .first<LoginSessionRow>();

    if (!row) {
      return null;
    }

    return {
      sessionId: row.session_id,
      qrcodeToken: row.qrcode_token,
      qrcodeImgContent: row.qrcode_img_content,
      status: row.status,
      expiresAt: row.expires_at,
      botId: row.bot_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  public async updateStatus(sessionId: string, status: LoginSessionStatus, updatedAt: string, botId: string | null): Promise<void> {
    await this.db
      .prepare(
        `
          UPDATE login_session
          SET status = ?, bot_id = ?, updated_at = ?
          WHERE session_id = ?
        `
      )
      .bind(status, botId, updatedAt, sessionId)
      .run();
  }
}

