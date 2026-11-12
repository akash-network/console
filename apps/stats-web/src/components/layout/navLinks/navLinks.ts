import { SnapshotsUrlParam } from "@/types/snapshots";

export type NavLink = {
  title: string;
  href: string;
  activePaths: string[];
};

export const NAV_LINKS: NavLink[] = [
  { title: "Dashboard", href: "/", activePaths: ["/"] },
  { title: "Graphs", href: `/graph/${SnapshotsUrlParam.dailyUsdSpent}`, activePaths: ["/graph", "/provider-graph"] },
  { title: "Blocks", href: "/blocks", activePaths: ["/blocks"] },
  { title: "Transactions", href: "/transactions", activePaths: ["/transactions"] },
  { title: "Validators", href: "/validators", activePaths: ["/validators"] },
  { title: "BME", href: "/bme", activePaths: ["/bme", "/bme-graph"] },
  { title: "Solana migration", href: "/solana-migration", activePaths: ["/solana-migration", "/solana-migration-graph"] }
];

export function isActiveNavLink(link: NavLink, pathname: string) {
  return link.activePaths.some(path => pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)));
}
