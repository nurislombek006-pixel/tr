// env.js
// Telegram bot token и chat ID здесь НЕ хранятся.
// Они должны быть только в Cloudflare Worker Secrets.

(function () {
  window.__APP_ENV = {
    REPORT_PROXY_URL: "https://shrill-waterfall-46fd.nurislombek006.workers.dev/",
    REPORT_SECRET: "Nurislombek_Report_Secret_2026"
  };
})();
