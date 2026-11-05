"use client";
import type { FC } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { rehypeOpenLinksWithoutOpener } from "@src/components/shared/rehypeOpenLinksWithoutOpener/rehypeOpenLinksWithoutOpener";

/** Images would load whatever URL an answer names, which logs or SDL the assistant read could have planted, so they never render. */
const DISALLOWED_ELEMENTS = ["img"];

/** Answers are model output, so raw HTML is never rendered and every link opens without a handle back to Console. */
export const AssistantMarkdown: FC<{ children: string }> = ({ children }) => (
  <ReactMarkdown
    className="prose prose-sm max-w-full break-words dark:prose-invert prose-p:my-1.5 prose-code:before:hidden prose-code:after:hidden prose-pre:my-2 prose-pre:bg-muted prose-pre:text-foreground prose-ol:my-1.5 prose-ul:my-1.5"
    skipHtml
    linkTarget="_blank"
    disallowedElements={DISALLOWED_ELEMENTS}
    unwrapDisallowed
    remarkPlugins={[remarkGfm]}
    rehypePlugins={[rehypeOpenLinksWithoutOpener]}
  >
    {children}
  </ReactMarkdown>
);
