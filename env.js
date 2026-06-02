// env.js
// ВАЖНО: здесь больше нет Telegram bot token и chat ID.
// Отчёты отправляются через Cloudflare Worker.

(function () {
  window.__APP_ENV = {
    // Сюда вставь ссылку своего Cloudflare Worker
    REPORT_PROXY_URL: "https://shrill-waterfall-46fd.ТВОЙ-SUBDOMAIN.workers.dev",

    // Должен совпадать с REPORT_SECRET в Cloudflare Worker Secrets
    REPORT_SECRET: "Nurislombek_Report_Secret_2026"
  };
})();
