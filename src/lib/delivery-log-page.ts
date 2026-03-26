const escapeHtml = (input: string): string =>
  input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

export const renderDeliveryLogPage = (input: {
  adminToken: string;
  initialStatus?: string;
  initialSource?: string;
  initialLimit: number;
  initialRefreshSeconds: number;
}): string => {
  const escapedToken = escapeHtml(input.adminToken);
  const escapedStatus = escapeHtml(input.initialStatus ?? "");
  const escapedSource = escapeHtml(input.initialSource ?? "");

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>投递日志中心</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f8fc;
        --card: rgba(255, 255, 255, 0.9);
        --line: #d6dfeb;
        --text: #16202f;
        --muted: #556273;
        --accent: #0f766e;
        --accent-soft: #dff5f2;
        --shadow: 0 24px 80px rgba(24, 39, 75, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, #edf8f5 0%, transparent 34%),
          radial-gradient(circle at top right, #eaf0ff 0%, transparent 28%),
          var(--bg);
      }
      .shell {
        min-height: 100vh;
        padding: 24px;
      }
      .stack {
        width: min(1280px, 100%);
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
        gap: 16px;
        flex-wrap: wrap;
      }
      h1 {
        margin: 0 0 8px;
        font-size: 32px;
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
        margin-top: 14px;
        padding: 10px 14px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-weight: 600;
      }
      .filters {
        padding: 0 28px 28px;
        display: grid;
        gap: 14px;
      }
      .filters-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 14px;
      }
      label {
        display: grid;
        gap: 8px;
        font-size: 13px;
        color: var(--muted);
        font-weight: 600;
      }
      input,
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 12px 14px;
        background: #fff;
        color: var(--text);
        font: inherit;
      }
      .actions {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      button,
      a.button {
        appearance: none;
        border: 0;
        border-radius: 999px;
        padding: 12px 18px;
        background: var(--text);
        color: #fff;
        text-decoration: none;
        cursor: pointer;
        font-weight: 700;
      }
      button.secondary,
      a.secondary {
        background: transparent;
        color: var(--text);
        border: 1px solid var(--line);
      }
      .dashboard {
        display: grid;
        grid-template-columns: minmax(0, 1.6fr) minmax(320px, 0.8fr);
        gap: 20px;
      }
      .table-card,
      .detail-card {
        overflow: hidden;
      }
      .section-head {
        padding: 22px 24px 0;
      }
      .section-head h2 {
        margin: 0 0 6px;
        font-size: 22px;
      }
      .section-head p {
        font-size: 14px;
      }
      .table-wrap {
        padding: 18px 24px 24px;
        overflow: auto;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th,
      td {
        text-align: left;
        padding: 14px 12px;
        border-bottom: 1px solid #edf1f7;
        vertical-align: top;
        font-size: 14px;
      }
      th {
        color: var(--muted);
        font-weight: 700;
        white-space: nowrap;
      }
      td code {
        font-size: 12px;
      }
      .badge {
        display: inline-flex;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }
      .badge.queued { background: #e0f2fe; color: #075985; }
      .badge.retrying { background: #fef3c7; color: #92400e; }
      .badge.delivered { background: #dcfce7; color: #166534; }
      .badge.failed { background: #fee2e2; color: #991b1b; }
      .text-preview {
        max-width: 280px;
        color: var(--text);
        line-height: 1.6;
        word-break: break-word;
      }
      .mono {
        font-family: Consolas, "SFMono-Regular", monospace;
        background: #f4f7fb;
        border-radius: 8px;
        padding: 2px 6px;
      }
      .detail-box {
        padding: 18px 24px 24px;
        display: grid;
        gap: 14px;
      }
      .detail-state {
        padding: 14px 16px;
        border-radius: 16px;
        background: #f8fafc;
        border: 1px solid var(--line);
        color: var(--muted);
      }
      pre {
        margin: 0;
        padding: 18px;
        border-radius: 18px;
        background: #111827;
        color: #e5eefb;
        overflow: auto;
        min-height: 320px;
        font-size: 13px;
        line-height: 1.6;
      }
      .tiny {
        font-size: 13px;
        color: var(--muted);
      }
      @media (max-width: 1100px) {
        .filters-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .dashboard {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 720px) {
        .filters-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <div class="stack">
        <section class="card">
          <div class="hero">
            <div>
              <h1>投递日志中心</h1>
              <p>复用现有管理接口的只读日志页，支持状态筛选、按来源过滤、自动刷新和单条详情查看。</p>
              <div class="pill" id="status-pill">正在准备日志视图...</div>
            </div>
            <div class="actions">
              <a class="button secondary" href="/admin/bot/login/qrcode/page?token=${escapedToken}">登录二维码页</a>
              <button id="refresh-btn">手动刷新</button>
            </div>
          </div>

          <div class="filters">
            <div class="filters-grid">
              <label>
                状态
                <select id="status-input">
                  <option value="">全部状态</option>
                  <option value="queued">queued</option>
                  <option value="retrying">retrying</option>
                  <option value="delivered">delivered</option>
                  <option value="failed">failed</option>
                </select>
              </label>
              <label>
                Source
                <input id="source-input" placeholder="例如 github / admin" value="${escapedSource}" />
              </label>
              <label>
                数量
                <select id="limit-input">
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </label>
              <label>
                自动刷新
                <select id="refresh-seconds-input">
                  <option value="0">关闭</option>
                  <option value="3">3 秒</option>
                  <option value="5">5 秒</option>
                  <option value="10">10 秒</option>
                  <option value="30">30 秒</option>
                </select>
              </label>
              <label>
                当前 API
                <input id="api-url" readonly />
              </label>
            </div>
            <div class="actions">
              <button id="apply-btn">应用筛选</button>
              <button class="secondary" id="copy-url-btn">复制 API 地址</button>
            </div>
          </div>
        </section>

        <section class="dashboard">
          <section class="card table-card">
            <div class="section-head">
              <h2>最近日志</h2>
              <p id="table-subtitle">正在加载...</p>
            </div>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>状态</th>
                    <th>Source</th>
                    <th>消息预览</th>
                    <th>尝试</th>
                    <th>响应</th>
                    <th>详情</th>
                  </tr>
                </thead>
                <tbody id="delivery-body">
                  <tr>
                    <td colspan="7" class="tiny">暂无数据</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <aside class="card detail-card">
            <div class="section-head">
              <h2>详情面板</h2>
              <p>点击日志行里的“查看”按钮，可加载单条投递详情。</p>
            </div>
            <div class="detail-box">
              <div class="detail-state" id="detail-state">还没有选中的日志。</div>
              <pre id="detail-json">{}</pre>
            </div>
          </aside>
        </section>
      </div>
    </main>

    <script>
      const adminToken = ${JSON.stringify(input.adminToken)};
      const initialStatus = ${JSON.stringify(input.initialStatus ?? "")};
      const initialSource = ${JSON.stringify(input.initialSource ?? "")};
      const initialLimit = ${JSON.stringify(String(input.initialLimit))};
      const initialRefreshSeconds = ${JSON.stringify(String(input.initialRefreshSeconds))};

      const statusInput = document.getElementById("status-input");
      const sourceInput = document.getElementById("source-input");
      const limitInput = document.getElementById("limit-input");
      const refreshSecondsInput = document.getElementById("refresh-seconds-input");
      const apiUrlInput = document.getElementById("api-url");
      const applyBtn = document.getElementById("apply-btn");
      const refreshBtn = document.getElementById("refresh-btn");
      const copyUrlBtn = document.getElementById("copy-url-btn");
      const statusPill = document.getElementById("status-pill");
      const tableSubtitle = document.getElementById("table-subtitle");
      const deliveryBody = document.getElementById("delivery-body");
      const detailState = document.getElementById("detail-state");
      const detailJson = document.getElementById("detail-json");

      let autoRefreshTimer = null;

      const escapeHtml = (value) =>
        value
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");

      const badgeClass = (status) => {
        if (status === "queued" || status === "retrying" || status === "delivered" || status === "failed") {
          return status;
        }
        return "queued";
      };

      const buildApiUrl = () => {
        const url = new URL("/admin/deliveries", window.location.origin);
        url.searchParams.set("token", adminToken);
        url.searchParams.set("limit", limitInput.value || "20");
        if (statusInput.value) url.searchParams.set("status", statusInput.value);
        if (sourceInput.value.trim()) url.searchParams.set("source", sourceInput.value.trim());
        return url;
      };

      const syncUrl = () => {
        const url = new URL(window.location.href);
        url.searchParams.set("token", adminToken);
        url.searchParams.set("limit", limitInput.value || "20");
        url.searchParams.set("refresh", refreshSecondsInput.value || "0");
        if (statusInput.value) {
          url.searchParams.set("status", statusInput.value);
        } else {
          url.searchParams.delete("status");
        }
        if (sourceInput.value.trim()) {
          url.searchParams.set("source", sourceInput.value.trim());
        } else {
          url.searchParams.delete("source");
        }
        window.history.replaceState({}, "", url);
      };

      const setPageState = (text, tone) => {
        statusPill.textContent = text;
        statusPill.style.background = tone === "error" ? "#fee2e2" : tone === "success" ? "#dcfce7" : "#dff5f2";
        statusPill.style.color = tone === "error" ? "#991b1b" : tone === "success" ? "#166534" : "#0f766e";
      };

      const renderRows = (items) => {
        if (!items.length) {
          deliveryBody.innerHTML = '<tr><td colspan="7" class="tiny">当前筛选条件下没有日志。</td></tr>';
          return;
        }

        deliveryBody.innerHTML = items
          .map((item) => {
            const preview = item.text.length > 80 ? item.text.slice(0, 80) + "..." : item.text;
            const responseCode = item.responseCode ?? "-";
            return '<tr>'
              + '<td><div>' + escapeHtml(item.createdAt) + '</div><div class="tiny"><code class="mono">' + escapeHtml(item.deliveryId) + '</code></div></td>'
              + '<td><span class="badge ' + badgeClass(item.status) + '">' + escapeHtml(item.status) + '</span></td>'
              + '<td>' + escapeHtml(item.source) + '</td>'
              + '<td><div class="text-preview">' + escapeHtml(preview) + '</div></td>'
              + '<td>' + escapeHtml(String(item.attempts)) + '</td>'
              + '<td>' + escapeHtml(String(responseCode)) + '</td>'
              + '<td><button data-delivery-id="' + escapeHtml(item.deliveryId) + '">查看</button></td>'
              + '</tr>';
          })
          .join("");

        deliveryBody.querySelectorAll("button[data-delivery-id]").forEach((button) => {
          button.addEventListener("click", () => {
            loadDetail(button.getAttribute("data-delivery-id"));
          });
        });
      };

      const loadDetail = async (deliveryId) => {
        if (!deliveryId) return;
        detailState.textContent = "正在加载 " + deliveryId + " ...";
        const response = await fetch("/admin/deliveries/" + encodeURIComponent(deliveryId) + "?token=" + encodeURIComponent(adminToken));
        const payload = await response.json();
        if (!response.ok) {
          detailState.textContent = "详情加载失败：" + payload.message;
          detailJson.textContent = "{}";
          return;
        }

        detailState.textContent = "当前查看：" + deliveryId;
        detailJson.textContent = JSON.stringify(payload.data, null, 2);
      };

      const loadDeliveries = async () => {
        const url = buildApiUrl();
        apiUrlInput.value = url.toString();
        syncUrl();
        setPageState("正在刷新日志...", "info");

        const response = await fetch(url);
        const payload = await response.json();
        if (!response.ok) {
          setPageState("日志加载失败：" + payload.message, "error");
          tableSubtitle.textContent = "无法读取日志，请检查 token 或筛选参数。";
          deliveryBody.innerHTML = '<tr><td colspan="7" class="tiny">日志加载失败。</td></tr>';
          return;
        }

        const items = payload.data.items || [];
        renderRows(items);
        tableSubtitle.textContent = "最近返回 " + items.length + " 条记录。";
        setPageState("日志已更新", "success");
      };

      const updateAutoRefresh = () => {
        if (autoRefreshTimer) {
          window.clearInterval(autoRefreshTimer);
          autoRefreshTimer = null;
        }
        const seconds = Number.parseInt(refreshSecondsInput.value || "0", 10);
        if (seconds > 0) {
          autoRefreshTimer = window.setInterval(loadDeliveries, seconds * 1000);
        }
      };

      statusInput.value = initialStatus;
      sourceInput.value = initialSource;
      limitInput.value = initialLimit;
      refreshSecondsInput.value = initialRefreshSeconds;

      applyBtn.addEventListener("click", () => {
        updateAutoRefresh();
        loadDeliveries();
      });

      refreshBtn.addEventListener("click", () => {
        loadDeliveries();
      });

      copyUrlBtn.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(apiUrlInput.value);
          setPageState("API 地址已复制到剪贴板", "success");
        } catch {
          setPageState("复制失败，请手动复制输入框内容。", "error");
        }
      });

      updateAutoRefresh();
      loadDeliveries();
    </script>
  </body>
</html>`;
};
