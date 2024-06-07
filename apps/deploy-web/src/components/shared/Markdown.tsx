"use client";
import ReactMarkdown from "react-markdown";
import { useTheme } from "next-themes";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { cn } from "@src/utils/styleUtils";

import "highlight.js/styles/vs2015.css";

type MarkdownProps = {
  children?: React.ReactNode | string;
};

const Markdown: React.FunctionComponent<MarkdownProps> = ({ children }) => {
  const { resolvedTheme } = useTheme();

  return (
    <ReactMarkdown
      className={cn(
        "markdownContainerRoot prose dark:prose-invert prose-code:before:hidden prose-code:after:hidden",
        resolvedTheme === "dark" ? "markdownContainer-dark" : "markdownContainer"
      )}
      linkTarget="_blank"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
    >
      {children as string}
    </ReactMarkdown>
  );
};

export default Markdown;
