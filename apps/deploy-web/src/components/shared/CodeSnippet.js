"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeSnippet = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var notistack_1 = require("notistack");
var copyClipboard_1 = require("@src/utils/copyClipboard");
var stringUtils_1 = require("@src/utils/stringUtils");
var CodeSnippet = function (_a) {
    var code = _a.code;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var codeRef = (0, react_1.useRef)(null);
    var onCopyClick = function () {
        (0, copyClipboard_1.copyTextToClipboard)(code);
        enqueueSnackbar(<components_1.Snackbar title="Copied to clipboard!" iconVariant="success"/>, { variant: "success", autoHideDuration: 1500 });
    };
    var onCodeClick = function () {
        if (codeRef === null || codeRef === void 0 ? void 0 : codeRef.current)
            (0, stringUtils_1.selectText)(codeRef.current);
    };
    return (<pre className="relative rounded-sm bg-popover p-4 pt-6 text-sm">
      <div className="absolute left-0 top-0 flex w-full justify-end p-2">
        <components_1.Button aria-label="copy" aria-haspopup="true" onClick={onCopyClick} size="icon" variant="ghost" type="button">
          <iconoir_react_1.Copy />
        </components_1.Button>
      </div>
      <code ref={codeRef} onClick={onCodeClick} className="whitespace-pre-wrap break-words">
        {code}
      </code>
    </pre>);
};
exports.CodeSnippet = CodeSnippet;
