export const SELF_CUSTODY_ROUTES = ["/get-started/wallet"];

export function isSelfCustodyRoute(path: string): boolean {
  const normalized = path.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  return SELF_CUSTODY_ROUTES.includes(normalized);
}
