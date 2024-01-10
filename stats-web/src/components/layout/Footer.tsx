import getConfig from "next/config";
import { Copyright } from "iconoir-react";
const { publicRuntimeConfig } = getConfig();

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="py-6 md:px-8 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
        <p className="text-balance flex items-center text-center text-sm leading-loose text-muted-foreground md:text-left">
          <Copyright className="text-xs" />
          &nbsp;Akash Network {year}
        </p>

        <span className="text-xs">v{publicRuntimeConfig?.version}</span>
      </div>
    </footer>
  );
}
