"use client";
import "highlight.js/styles/vs2015.css";

import ReactMarkdown from "react-markdown";
import type { PluggableList } from "react-markdown/lib/react-markdown";
import { cn } from "@akashnetwork/ui/utils";
import { useTheme } from "next-themes";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import type { Options as SanitizeSchema } from "rehype-sanitize";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";

/** Unwrapping these instead would print their script, CSS, markup or fallback text into the page. */
const ELEMENTS_DROPPED_WITH_THEIR_CONTENT = ["script", "style", "iframe", "noscript", "template"];

/** GitHub's README allowlist, extended with the elements and classes that template READMEs use. */
const PASSIVE_HTML_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  strip: ELEMENTS_DROPPED_WITH_THEIR_CONTENT,
  tagNames: [...defaultSchema.tagNames!, "picture", "source", "video", "u"],
  attributes: {
    ...defaultSchema.attributes,
    code: [["className", /^language-./]],
    ul: [["className", "contains-task-list"]],
    source: ["srcSet"],
    video: ["src", "controls", "poster"]
  },
  protocols: { ...defaultSchema.protocols, poster: ["http", "https"] }
};

const HIGHLIGHT_PLUGIN: PluggableList[number] = [rehypeHighlight, { ignoreMissing: true }];

const MARKDOWN_PLUGINS: PluggableList = [HIGHLIGHT_PLUGIN];

/** Highlighting runs after sanitizing because the schema does not allow the classes highlight.js adds. */
const HTML_PLUGINS: PluggableList = [rehypeRaw as any, [rehypeSanitize, PASSIVE_HTML_SCHEMA], HIGHLIGHT_PLUGIN];

type MarkdownProps = {
  children?: React.ReactNode | string;
  hasHtml?: boolean;
  className?: string;
  /** Run after the built-in ones, so raw HTML is already part of the tree they see. */
  rehypePlugins?: PluggableList;
};

const Markdown: React.FunctionComponent<MarkdownProps> = ({ children, hasHtml, className, rehypePlugins: extraRehypePlugins = [] }) => {
  const { resolvedTheme } = useTheme();

  return (
    <ReactMarkdown
      className={cn(
        "markdownContainerRoot prose max-w-full dark:prose-invert prose-code:before:hidden prose-code:after:hidden prose-img:inline",
        resolvedTheme === "dark" ? "markdownContainer-dark" : "markdownContainer",
        className
      )}
      linkTarget="_blank"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[...(hasHtml ? HTML_PLUGINS : MARKDOWN_PLUGINS), ...extraRehypePlugins]}
    >
      {children as string}
    </ReactMarkdown>
  );
};

export default Markdown;
