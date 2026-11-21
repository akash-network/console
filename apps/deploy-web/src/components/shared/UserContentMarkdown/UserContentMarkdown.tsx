"use client";
import type { FC } from "react";
import type { PluggableList } from "react-markdown/lib/react-markdown";

import Markdown from "@src/components/shared/Markdown";
import { rehypeHardenUserContent } from "./rehypeHardenUserContent";

export const DEPENDENCIES = { Markdown };

export interface UserContentMarkdownProps {
  children: string;
  className?: string;
  /** Run before the hardening, which has the last word on every link and image. */
  rehypePlugins?: PluggableList;
  dependencies?: typeof DEPENDENCIES;
}

/** Markdown one user writes and others read: raw HTML shows as text, links only leave Console and images load only from listed sources. */
export const UserContentMarkdown: FC<UserContentMarkdownProps> = ({ children, className, rehypePlugins = [], dependencies: d = DEPENDENCIES }) => (
  <d.Markdown className={className} rehypePlugins={[...rehypePlugins, rehypeHardenUserContent]}>
    {children}
  </d.Markdown>
);
