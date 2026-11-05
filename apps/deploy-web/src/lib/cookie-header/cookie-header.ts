export interface CookieEntry {
  name: string;
  value: string;
}

/** Keeps every entry of a name the browser sent more than once, which parsers building a name-to-value map collapse to one. */
export function readCookieEntries(cookieHeader: string | null | undefined): CookieEntry[] {
  return (cookieHeader ?? "")
    .split(";")
    .map(part => part.trim())
    .filter(part => part.includes("="))
    .map(part => {
      const separatorIndex = part.indexOf("=");
      return { name: part.slice(0, separatorIndex), value: part.slice(separatorIndex + 1) };
    });
}
