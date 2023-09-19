import ReactMarkdown from "react-markdown";
import { lighten, useTheme } from "@mui/material";
import { makeStyles } from "tss-react/mui";

import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/vs2015.css";
import { cx } from "@emotion/css";

type MarkdownProps = {
  // markdown: string & { content?: string };
  children?: React.ReactNode | string;
};

const useStyles = makeStyles()(theme => ({
  root: {
    wordBreak: "break-word",
    ".codeStyle, pre, code, code span": {
      // Your SyntaxHighlighter override styles here
    },
    code: {
      // Your general code styles here
    },
    pre: {
      // Your code-block styles here
      overflow: "auto",
      borderRadius: ".2rem",
      padding: ".5rem"
    },
    table: {
      overflow: "auto",
      wordBreak: "break-all"
    },
    "h3 code": {
      color: "inherit"
    },
    "span.linenumber": {
      display: "none !important"
    },
    '[data="highlight"]': {
      // Your custom line highlight styles here
    }
  }
}));

const Markdown: React.FunctionComponent<MarkdownProps> = ({ children }) => {
  const { classes } = useStyles();
  const theme = useTheme();

  return (
    <ReactMarkdown
      className={cx(classes.root, theme.palette.mode === "dark" ? "markdownContainer-dark" : "markdownContainer")}
      linkTarget="_blank"
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
    >
      {children as string}
    </ReactMarkdown>
  );
};

export default Markdown;
