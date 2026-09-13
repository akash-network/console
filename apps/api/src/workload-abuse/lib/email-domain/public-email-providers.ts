/**
 * Kept in code rather than rows so it survives an empty or unreachable database and cannot be deleted by the
 * admin console, where the cost of a mistake is auto-blocking every account on a provider like gmail.com.
 */
const PUBLIC_EMAIL_PROVIDERS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "outlook.de",
  "hotmail.com",
  "hotmail.co.uk",
  "hotmail.fr",
  "live.com",
  "live.co.uk",
  "msn.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.fr",
  "ymail.com",
  "rocketmail.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "icloud.com",
  "me.com",
  "mac.com",
  "gmx.com",
  "gmx.de",
  "gmx.net",
  "mail.com",
  "mail.ru",
  "zoho.com",
  "yandex.com",
  "yandex.ru",
  "qq.com",
  "163.com",
  "126.com",
  "sina.com",
  "naver.com",
  "daum.net",
  "fastmail.com",
  "hey.com",
  "tutanota.com",
  "tuta.io",
  "duck.com",
  "web.de",
  "t-online.de",
  "free.fr",
  "orange.fr",
  "laposte.net",
  "comcast.net",
  "verizon.net",
  "bellsouth.net",
  "sbcglobal.net",
  "cox.net"
]);

/** Expects an already normalized domain, as produced by normalizeEmailDomain. */
export function isPublicEmailProvider(domain: string): boolean {
  return PUBLIC_EMAIL_PROVIDERS.has(domain);
}
