declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    INBOX_API_TOKEN: string;
  }
}

declare module "*.sql?raw" {
  const content: string;
  export default content;
}
