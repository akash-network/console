export function parseCookies(cookieHeader: string) {
  return cookieHeader.split(";").reduce(
    (cookies, cookie) => {
      const [key, value] = cookie.trim().split("=");
      cookies[key] = decodeURIComponent(value);
      return cookies;
    },
    {} as Record<string, string>
  );
}

export function parseSetCookies(setCookieHeader: string) {
  return setCookieHeader
    .replace(/Expires=[^;]+;/g, "")
    .split(",")
    .reduce<Record<string, string>>((cookies, cookie) => {
      // Extract the name=value part (everything before the first semicolon)
      const nameValueMatch = cookie.match(/^([^=]+)=([^;]*)/);
      if (nameValueMatch) {
        cookies[nameValueMatch[1]] = decodeURIComponent(nameValueMatch[2]);
      }
      return cookies;
    }, {});
}

export function serializeCookies(cookies: Record<string, string>, separator = "; ") {
  return Object.entries(cookies)
    .filter(([_, value]) => !!value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join(separator);
}
