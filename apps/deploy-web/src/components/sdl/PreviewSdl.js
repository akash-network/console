"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreviewSdl = void 0;
var components_1 = require("@akashnetwork/ui/components");
var react_1 = require("@monaco-editor/react");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
var notistack_1 = require("notistack");
var copyClipboard_1 = require("@src/utils/copyClipboard");
var PreviewSdl = function (_a) {
    var sdl = _a.sdl, onClose = _a.onClose;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var onCopyClick = function () {
        (0, copyClipboard_1.copyTextToClipboard)(sdl);
        enqueueSnackbar(<components_1.Snackbar title="SDL copied to clipboard!" iconVariant="success"/>, {
            variant: "success",
            autoHideDuration: 3000
        });
    };
    return (<components_1.Popup fullWidth open variant="custom" title="Preview SDL" actions={[
            {
                label: "Close",
                color: "primary",
                variant: "text",
                side: "right",
                onClick: onClose
            }
        ]} onClose={onClose} maxWidth="md" enableCloseOnBackdropClick>
      <div className="mb-4 flex items-center">
        <components_1.Button color="secondary" variant="default" onClick={onCopyClick} size="sm">
          Copy the SDL
          <iconoir_react_1.Copy className="ml-2 text-sm"/>
        </components_1.Button>
      </div>
      <div className="mb-2">
        <react_1.default height="500px" defaultLanguage="yaml" value={sdl} theme={resolvedTheme === "dark" ? "vs-dark" : "light"}/>
      </div>
    </components_1.Popup>);
};
exports.PreviewSdl = PreviewSdl;
