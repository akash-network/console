"use client";
import "highlight.js/styles/vs2015.css";

import ReactMarkdown from "react-markdown";
import { PluggableList } from "react-markdown/lib/react-markdown";
import { cn } from "@akashnetwork/ui/utils";
import { useTheme } from "next-themes";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";

type MarkdownProps = {
  children?: React.ReactNode | string;
  hasHtml?: boolean;
};

const Markdown: React.FunctionComponent<MarkdownProps> = ({ children, hasHtml }) => {
  const { resolvedTheme } = useTheme();

  const rehypePlugins: PluggableList = [[rehypeHighlight, { ignoreMissing: true }]];

  if (hasHtml) {
    rehypePlugins.push([rehypeRaw as any]);
  }

  return (
    <ReactMarkdown
      className={cn(
        "markdownContainerRoot prose max-w-full dark:prose-invert prose-code:before:hidden prose-code:after:hidden",
        resolvedTheme === "dark" ? "markdownContainer-dark" : "markdownContainer"
      )}
      linkTarget="_blank"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={rehypePlugins}
    >
      {children as string}
    </ReactMarkdown>
  );
};

export default Markdown;
