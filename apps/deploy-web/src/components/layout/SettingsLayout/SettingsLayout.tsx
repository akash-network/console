"use client";
import React, { type ReactNode } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback } from "@akashnetwork/ui/components";
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

export const SettingsLayout: React.FunctionComponent<Props> = ({ title, description, headerActions, children, dependencies: d = DEPENDENCIES }) => {
  const links = d.useSettingsNavLinks();

  return (
    <div className="flex w-full flex-col md:h-page-viewport md:flex-row">
      <nav
        aria-label="Settings"
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-background px-4 py-3 md:w-[216px] md:flex-col md:overflow-y-auto md:border-b-0 md:border-r md:py-7"
      >
        {links.map(link => (
          <d.Link
            key={link.title}
            href={link.url}
            aria-current={link.isActive ? "page" : undefined}
            className="block whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors aria-[current=page]:bg-muted aria-[current=page]:font-semibold hover:bg-muted"
          >
            {link.title}
          </d.Link>
        ))}
      </nav>

      <div className="min-w-0 flex-1 md:min-h-0 md:overflow-y-auto">
        {(title || headerActions) && (
          <div className="sticky top-[var(--app-header-height,57px)] z-30 flex min-h-[60px] items-center border-b border-border bg-background py-2.5 md:top-0">
            <div className="container flex flex-wrap items-center justify-between gap-4 px-6">
              {title && <d.Title className="text-xl">{title}</d.Title>}
              {headerActions}
            </div>
          </div>
        )}
        <div className="container px-6">
          {description && <p className="pt-5 text-sm text-muted-foreground">{description}</p>}

          <ErrorBoundary FallbackComponent={ErrorFallback}>
            <div className="space-y-6 pb-10 pt-6">{children}</div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};
