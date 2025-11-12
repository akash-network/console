"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
require("highlight.js/styles/vs2015.css");
var react_markdown_1 = require("react-markdown");
var utils_1 = require("@akashnetwork/ui/utils");
var next_themes_1 = require("next-themes");
var rehype_highlight_1 = require("rehype-highlight");
var rehype_raw_1 = require("rehype-raw");
var remark_gfm_1 = require("remark-gfm");
var Markdown = function (_a) {
    var children = _a.children, hasHtml = _a.hasHtml;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var rehypePlugins = [[rehype_highlight_1.default, { ignoreMissing: true }]];
    if (hasHtml) {
        rehypePlugins.push([rehype_raw_1.default]);
    }
    return (<react_markdown_1.default className={(0, utils_1.cn)("markdownContainerRoot prose max-w-full dark:prose-invert prose-code:before:hidden prose-code:after:hidden", resolvedTheme === "dark" ? "markdownContainer-dark" : "markdownContainer")} linkTarget="_blank" remarkPlugins={[remark_gfm_1.default]} rehypePlugins={rehypePlugins}>
      {children}
    </react_markdown_1.default>);
};
exports.default = Markdown;
