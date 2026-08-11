"use client";
import React, { type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { Title } from "@src/components/shared/Title";
import { useSettingsNavLinks } from "@src/hooks/useSettingsNavLinks";

export const DEPENDENCIES = { useSettingsNavLinks, Link, Title };

type Props = {
  title?: string;
  description?: ReactNode;
  headerActions?: ReactNode;
  children?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

function navLinkClasses(isActive: boolean) {
  return cn("block whitespace-nowrap rounded-md px-3 py-2 text-sm transition-colors", {
    "bg-accent font-medium text-foreground": isActive,
    "text-muted-foreground hover:bg-accent hover:text-foreground": !isActive
  });
}

export const SettingsLayout: React.FunctionComponent<Props> = ({ title, description, headerActions, children, dependencies: d = DEPENDENCIES }) => {
  const links = d.useSettingsNavLinks();

  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-10">
      <nav aria-label="Settings" className="flex shrink-0 gap-1 overflow-x-auto md:w-48 md:flex-col md:overflow-visible">
        {links.map(link => (
          <d.Link key={link.title} href={link.url} aria-current={link.isActive ? "page" : undefined} className={navLinkClasses(link.isActive)}>
            {link.title}
          </d.Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        {(title || headerActions) && (
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6">
            <div className="space-y-1">
              {title && <d.Title>{title}</d.Title>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {headerActions}
          </div>
        )}

        <ErrorBoundary FallbackComponent={ErrorFallback}>
          <div className="space-y-6">{children}</div>
        </ErrorBoundary>
      </div>
    </div>
  );
};
