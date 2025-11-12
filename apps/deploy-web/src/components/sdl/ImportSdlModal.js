"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImportSdlModal = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_2 = require("@monaco-editor/react");
var iconoir_react_1 = require("iconoir-react");
var next_themes_1 = require("next-themes");
var notistack_1 = require("notistack");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
var timer_1 = require("@src/utils/timer");
var ImportSdlModal = function (_a) {
    var onClose = _a.onClose, setValue = _a.setValue;
    var _b = (0, react_1.useState)(""), sdl = _b[0], setSdl = _b[1];
    var _c = (0, react_1.useState)(null), parsingError = _c[0], setParsingError = _c[1];
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var onEditorMount = (0, react_1.useCallback)(function (editorInstance) {
        editorInstance.focus();
    }, []);
    (0, react_1.useEffect)(function () {
        var timer = (0, timer_1.Timer)(500);
        timer.start().then(function () {
            createAndValidateSdl(sdl || "");
        });
        return function () {
            if (timer) {
                timer.abort();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sdl]);
    var createAndValidateSdl = function (yamlStr) {
        try {
            if (!yamlStr)
                return null;
            var services = (0, sdlImport_1.importSimpleSdl)(yamlStr);
            setParsingError(null);
            return services;
        }
        catch (err) {
            if (err.name === "YAMLException" || err.name === "CustomValidationError") {
                setParsingError(err.message);
            }
            else if (err.name === "TemplateValidation") {
                setParsingError(err.message);
            }
            else {
                setParsingError("Error while parsing SDL file");
                // setParsingError(err.message);
                console.error(err);
            }
        }
    };
    var onImport = function () {
        var result = createAndValidateSdl(sdl || "");
        if (!result)
            return;
        setValue("services", result);
        enqueueSnackbar(<components_1.Snackbar title="Import success!" iconVariant="success"/>, {
            variant: "success",
            autoHideDuration: 4000
        });
        analytics_service_1.analyticsService.track("import_sdl", {
            category: "sdl_builder",
            label: "Import SDL"
        });
        onClose();
    };
    return (<components_1.Popup fullWidth open={true} variant="custom" title="Import SDL" actions={[
            {
                label: "Close",
                color: "primary",
                variant: "text",
                side: "left",
                onClick: onClose
            },
            {
                label: "Import",
                color: "secondary",
                variant: "default",
                side: "right",
                disabled: !sdl || !!parsingError,
                onClick: onImport
            }
        ]} onClose={onClose} maxWidth="md" enableCloseOnBackdropClick>
      <h6 className="mb-4 flex items-center text-muted-foreground">
        Paste your sdl here to import <iconoir_react_1.ArrowDown className="ml-4 text-sm"/>
      </h6>
      <div className="mb-2">
        <react_2.default height="500px" defaultLanguage="yaml" value={sdl} onChange={function (value) { return setSdl(value); }} theme={resolvedTheme === "dark" ? "vs-dark" : "light"} onMount={onEditorMount}/>
      </div>
      {parsingError && (<components_1.Alert className="mt-4" variant="destructive">
          {parsingError}
        </components_1.Alert>)}
    </components_1.Popup>);
};
exports.ImportSdlModal = ImportSdlModal;
