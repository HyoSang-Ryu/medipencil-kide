declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    KIDE_BASE_URL?: string;
    KIDE_API_KEY?: string;
    ADMIN_EMAIL?: string;
    BUCKET?: R2Bucket;
  }
}
