const escapeHtml = (input: string): string =>
  input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderDashboardPage = (input: {
  adminToken: string;
  refreshSeconds: number;
  logsLimit: number;
}): string => {
  const escapedToken = escapeHtml(input.adminToken);

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>iLink 管理总览</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f4f7fb;
        --card: rgba(255, 255, 255, 0.92);
        --line: #d6dfeb;
        --text: #16202f;
        --muted: #556273;
        --accent: #0f766e;
        --accent-soft: #dff5f2;
        --danger-soft: #fee2e2;
        --danger: #991b1b;
        --success-soft: #dcfce7;
        --success: #166534;
        --shadow: 0 24px 80px rgba(24, 39, 75, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, #eafaf6 0%, transparent 32%),
          radial-gradient(circle at top right, #ecf1ff 0%, transparent 30%),
          var(--bg);
      }
      .shell {
        min-height: 100vh;
        padding: 24px;
      }
      .stack {
        width: min(1320px, 100%);
        margin: 0 auto;
        display: grid;
        gap: 20px;
      }
      .card {
        background: var(--card);
        border: 1px solid rgba(214, 223, 235, 0.88);
        backdrop-filter: blur(10px);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }
      .hero {
        padding: 28px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 18px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 34px;
      }
      h2 {
        margin: 0;
        font-size: 24px;
      }
      p {
        margin: 0;
        color: var(--muted);
        line-height: 1.7;
      }
      .pill {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-top: 16px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 700;
      }
      .hero-actions,
      .section-actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        align-items: center;
      }
      .hero-actions > *,
      .section-actions > * {
        flex: 0 0 auto;
      }
      button,
      a.button {
        appearance: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        min-height: 46px;
        background: var(--text);
        color: #fff;
        text-decoration: none;
        cursor: pointer;
        font-weight: 700;
        font-size: 14px;
        line-height: 1.2;
        text-align: center;
        white-space: nowrap;
      }
      button.secondary,
      a.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
      }
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 1.15fr);
        gap: 20px;
      }
      .section {
        padding: 24px;
        display: grid;
        gap: 18px;
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
        flex-wrap: wrap;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .metric {
        padding: 16px 18px;
        border-radius: 18px;
        background: #f8fafc;
        border: 1px solid var(--line);
      }
      .metric strong {
        display: block;
        margin-bottom: 8px;
        font-size: 13px;
        color: var(--muted);
      }
      .metric span {
        font-size: 20px;
        font-weight: 800;
        word-break: break-word;
      }
      .status-banner {
        padding: 16px 18px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: #f8fafc;
      }
      .status-banner strong {
        display: block;
        margin-bottom: 8px;
      }
      .status-banner.success {
        background: var(--success-soft);
        color: var(--success);
        border-color: #bbf7d0;
      }
      .status-banner.warning {
        background: #fef3c7;
        color: #92400e;
        border-color: #fde68a;
      }
      .status-banner.error {
        background: var(--danger-soft);
        color: var(--danger);
        border-color: #fecaca;
      }
      .quick-links {
        display: grid;
        gap: 12px;
      }
      .quick-link {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        padding: 15px 16px;
        border-radius: 18px;
        background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
        border: 1px solid var(--line);
        text-decoration: none;
        color: inherit;
      }
      .quick-link small {
        color: var(--muted);
        display: block;
        margin-top: 4px;
      }
      .form-grid {
        display: grid;
        gap: 14px;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
        font-weight: 700;
      }
      input,
      textarea,
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px 14px;
        background: #fff;
        color: var(--text);
        font: inherit;
      }
      textarea {
        min-height: 140px;
        resize: vertical;
      }
      .form-note {
        font-size: 13px;
        color: var(--muted);
      }
      .message-box {
        padding: 14px 16px;
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      .message-box.success {
        background: var(--success-soft);
        color: var(--success);
        border-color: #bbf7d0;
      }
      .message-box.error {
        background: var(--danger-soft);
        color: var(--danger);
        border-color: #fecaca;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        padding: 13px 10px;
        text-align: left;
        border-bottom: 1px solid #edf1f7;
        vertical-align: top;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-weight: 700;
      }
      .badge {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 800;
      }
      .badge.queued { background: #e0f2fe; color: #075985; }
      .badge.retrying { background: #fef3c7; color: #92400e; }
      .badge.delivered { background: #dcfce7; color: #166534; }
      .badge.failed { background: #fee2e2; color: #991b1b; }
      .tiny {
        font-size: 13px;
        color: var(--muted);
      }
      .mono {
        font-family: Consolas, "SFMono-Regular", monospace;
      }
      code {
        font-family: Consolas, "SFMono-Regular", monospace;
        background: #f4f7fb;
        border-radius: 8px;
        padding: 2px 6px;
      }
      @media (max-width: 1100px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .metrics {
          grid-template-columns: 1fr;
        }
        .hero-actions,
        .section-actions {
          width: 100%;
        }
        .hero-actions > *,
        .section-actions > * {
          flex: 1 1 180px;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="stack">
        <section class="card hero">
          <div>
            <h1>iLink 管理总览</h1>
            <p>把 bot 登录、激活、测试发信和最近日志集中在一个页面里，适合部署后做日常巡检和快速操作。</p>
            <div class="pill" id="hero-pill">正在加载 bot 状态...</div>
          </div>
          <div class="hero-actions">
            <button id="refresh-all-btn">刷新总览</button>
            <a class="button secondary" href="/admin/bot/login/qrcode/page?token=${escapedToken}">打开二维码页</a>
            <a class="button secondary" href="/admin/deliveries/page?token=${escapedToken}">打开日志中心</a>
          </div>
        </section>

        <section class="grid">
          <section class="card section">
            <div class="section-head">
              <div>
                <h2>Bot 状态</h2>
                <p>自动轮询当前 bot 登录态，并提供激活与扫码入口。</p>
              </div>
              <div class="section-actions">
                <button class="secondary" id="refresh-status-btn">刷新状态</button>
                <button id="activate-btn">尝试激活</button>
              </div>
            </div>

            <div class="metrics">
              <div class="metric">
                <strong>当前状态</strong>
                <span id="bot-status-value">-</span>
              </div>
              <div class="metric">
                <strong>Bot ID</strong>
                <span id="bot-id-value">-</span>
              </div>
              <div class="metric">
                <strong>最后更新时间</strong>
                <span id="bot-updated-value">-</span>
              </div>
              <div class="metric">
                <strong>自动刷新</strong>
                <span>${input.refreshSeconds} 秒</span>
              </div>
            </div>

            <div class="status-banner" id="bot-banner">
              <strong>状态提示</strong>
              <div id="bot-banner-text">正在读取 bot 状态...</div>
            </div>

            <div class="quick-links">
              <a class="quick-link" href="/admin/bot/login/qrcode/page?token=${escapedToken}">
                <div>
                  <strong>扫码登录 / 换绑 bot</strong>
                  <small>打开二维码页，创建新会话并在浏览器里完成扫码与激活。</small>
                </div>
                <span>打开</span>
              </a>
              <a class="quick-link" href="/admin/deliveries/page?token=${escapedToken}">
                <div>
                  <strong>查看完整投递日志</strong>
                  <small>进入日志中心筛选状态、查看详情与自动刷新。</small>
                </div>
                <span>打开</span>
              </a>
            </div>
          </section>

          <section class="card section">
            <div class="section-head">
              <div>
                <h2>手动发送测试</h2>
                <p>通过现有 <code>/api/send</code> 发送一条测试通知，仍然走队列链路。</p>
              </div>
            </div>

            <div class="form-grid">
              <label>
                文本内容
                <textarea id="send-text" placeholder="输入一条测试消息，例如：Cloudflare deploy succeeded."></textarea>
              </label>
              <label>
                幂等键（可选）
                <input id="send-dedupe" placeholder="例如 deploy-20260326-1" />
              </label>
              <div class="section-actions">
                <button id="send-btn">发送测试消息</button>
              </div>
              <div class="form-note">如果 bot 处于 <code>logged_in</code> / <code>needs_activation</code>，请先点击左侧“尝试激活”。</div>
              <div class="message-box" id="send-message">等待发送操作。</div>
            </div>
          </section>
        </section>

        <section class="card section">
          <div class="section-head">
            <div>
              <h2>最近日志</h2>
              <p>总览页默认展示最近 ${input.logsLimit} 条日志，便于快速确认发送链路是否正常。</p>
            </div>
            <div class="section-actions">
              <button class="secondary" id="refresh-logs-btn">刷新日志</button>
            </div>
          </div>

          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>时间</th>
                  <th>状态</th>
                  <th>Source</th>
                  <th>消息预览</th>
                  <th>尝试</th>
                  <th>响应</th>
                </tr>
              </thead>
              <tbody id="recent-log-body">
                <tr><td colspan="6" class="tiny">正在加载日志...</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>

    <script>
      const adminToken = ${JSON.stringify(input.adminToken)};
      const refreshSeconds = ${JSON.stringify(input.refreshSeconds)};
      const logsLimit = ${JSON.stringify(input.logsLimit)};

      const heroPill = document.getElementById("hero-pill");
      const botStatusValue = document.getElementById("bot-status-value");
      const botIdValue = document.getElementById("bot-id-value");
      const botUpdatedValue = document.getElementById("bot-updated-value");
      const botBanner = document.getElementById("bot-banner");
      const botBannerText = document.getElementById("bot-banner-text");
      const sendText = document.getElementById("send-text");
      const sendDedupe = document.getElementById("send-dedupe");
      const sendMessage = document.getElementById("send-message");
      const recentLogBody = document.getElementById("recent-log-body");
      const activateBtn = document.getElementById("activate-btn");
      const sendBtn = document.getElementById("send-btn");

      const escapeHtml = (value) =>
        value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");

      const setHeroPill = (text, tone) => {
        heroPill.textContent = text;
        heroPill.style.background = tone === "error" ? "#fee2e2" : tone === "success" ? "#dcfce7" : "#dff5f2";
        heroPill.style.color = tone === "error" ? "#991b1b" : tone === "success" ? "#166534" : "#0f766e";
      };

      const setBanner = (title, text, tone) => {
        botBanner.className = "status-banner " + (tone || "");
        botBanner.querySelector("strong").textContent = title;
        botBannerText.textContent = text;
      };

      const statusHint = (status, lastError) => {
        if (status === "ready") {
          return {
            tone: "success",
            title: "Bot 已就绪",
            text: "当前 bot 已激活，可以直接测试发信。"
          };
        }
        if (status === "not_logged_in") {
          return {
            tone: "warning",
            title: "尚未登录",
            text: "当前还没有已登录 bot，请先打开二维码页完成登录。"
          };
        }
        if (status === "logged_in" || status === "needs_activation") {
          return {
            tone: "warning",
            title: "等待激活",
            text: lastError || "已登录，但还没有上下文。请先给“微信ClawBot”发一条消息，再尝试激活。"
          };
        }
        if (status === "needs_login") {
          return {
            tone: "error",
            title: "需要重新登录",
            text: lastError || "登录态可能失效，请重新扫码登录。"
          };
        }
        return {
          tone: "error",
          title: "状态异常",
          text: lastError || "请检查上游响应和最近日志。"
        };
      };

      const badgeClass = (status) => {
        if (status === "queued" || status === "retrying" || status === "delivered" || status === "failed") {
          return status;
        }
        return "queued";
      };

      const loadBotStatus = async () => {
        setHeroPill("正在刷新 bot 状态...", "info");
        const response = await fetch("/admin/bot/status?token=" + encodeURIComponent(adminToken));
        const payload = await response.json();
        if (!response.ok) {
          setHeroPill("bot 状态读取失败", "error");
          setBanner("读取失败", payload.message || "无法读取状态。", "error");
          return;
        }

        const data = payload.data;
        botStatusValue.textContent = data.status || "-";
        botIdValue.textContent = data.botId || "-";
        botUpdatedValue.textContent = data.updatedAt || "-";
        const hint = statusHint(data.status, data.lastError);
        setHeroPill("当前状态：" + data.status, hint.tone === "warning" ? "info" : hint.tone);
        setBanner(hint.title, hint.text, hint.tone);
      };

      const loadRecentLogs = async () => {
        const response = await fetch(
          "/admin/deliveries?token=" + encodeURIComponent(adminToken) + "&limit=" + encodeURIComponent(String(logsLimit))
        );
        const payload = await response.json();
        if (!response.ok) {
          recentLogBody.innerHTML = '<tr><td colspan="6" class="tiny">日志读取失败：' + escapeHtml(payload.message || "unknown") + '</td></tr>';
          return;
        }

        const items = payload.data.items || [];
        if (!items.length) {
          recentLogBody.innerHTML = '<tr><td colspan="6" class="tiny">暂无日志。</td></tr>';
          return;
        }

        recentLogBody.innerHTML = items
          .map((item) => {
            const preview = item.text.length > 90 ? item.text.slice(0, 90) + "..." : item.text;
            return '<tr>'
              + '<td><div>' + escapeHtml(item.createdAt) + '</div><div class="tiny"><code>' + escapeHtml(item.deliveryId) + '</code></div></td>'
              + '<td><span class="badge ' + badgeClass(item.status) + '">' + escapeHtml(item.status) + '</span></td>'
              + '<td>' + escapeHtml(item.source) + '</td>'
              + '<td>' + escapeHtml(preview) + '</td>'
              + '<td>' + escapeHtml(String(item.attempts)) + '</td>'
              + '<td>' + escapeHtml(String(item.responseCode ?? "-")) + '</td>'
              + '</tr>';
          })
          .join("");
      };

      const activateBot = async () => {
        activateBtn.disabled = true;
        setHeroPill("正在激活 bot...", "info");
        const response = await fetch("/admin/bot/activate?token=" + encodeURIComponent(adminToken), {
          method: "POST"
        });
        const payload = await response.json();
        if (!response.ok) {
          setHeroPill("激活失败", "error");
          setBanner("激活失败", payload.message || "未知错误", "error");
          activateBtn.disabled = false;
          return;
        }

        setBanner("激活结果", payload.data.message, payload.data.status === "ready" ? "success" : "warning");
        await loadBotStatus();
        activateBtn.disabled = false;
      };

      const sendTestMessage = async () => {
        const text = sendText.value.trim();
        if (!text) {
          sendMessage.className = "message-box error";
          sendMessage.textContent = "请先输入要发送的文本内容。";
          return;
        }

        sendBtn.disabled = true;
        sendMessage.className = "message-box";
        sendMessage.textContent = "正在提交发送请求...";

        const response = await fetch("/api/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + adminToken
          },
          body: JSON.stringify({
            text,
            dedupeKey: sendDedupe.value.trim() || undefined
          })
        });
        const payload = await response.json();
        if (!response.ok) {
          sendMessage.className = "message-box error";
          sendMessage.textContent = "发送失败：" + (payload.message || "未知错误");
          sendBtn.disabled = false;
          return;
        }

        sendMessage.className = "message-box success";
        sendMessage.textContent = "已入队：deliveryId=" + payload.data.deliveryId + "，状态=" + payload.data.status;
        sendBtn.disabled = false;
        sendText.value = "";
        await loadRecentLogs();
      };

      document.getElementById("refresh-all-btn").addEventListener("click", async () => {
        await loadBotStatus();
        await loadRecentLogs();
      });
      document.getElementById("refresh-status-btn").addEventListener("click", loadBotStatus);
      document.getElementById("refresh-logs-btn").addEventListener("click", loadRecentLogs);
      activateBtn.addEventListener("click", activateBot);
      sendBtn.addEventListener("click", sendTestMessage);

      window.setInterval(async () => {
        await loadBotStatus();
        await loadRecentLogs();
      }, refreshSeconds * 1000);

      loadBotStatus();
      loadRecentLogs();
    </script>
  </body>
</html>`;
};
