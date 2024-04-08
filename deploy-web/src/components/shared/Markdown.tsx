"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/vs2015.css";
import { useTheme } from "next-themes";
import { cn } from "@src/utils/styleUtils";

type MarkdownProps = {
  children?: React.ReactNode | string;
};

const Markdown: React.FunctionComponent<MarkdownProps> = ({ children }) => {
  const { theme } = useTheme();

  return (
    <ReactMarkdown
      className={cn(
        "markdownContainerRoot prose prose-code:before:hidden prose-code:after:hidden",
        theme === "dark" ? "markdownContainer-dark" : "markdownContainer"
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
