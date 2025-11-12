"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
require("xterm/css/xterm.css");
var react_1 = require("react");
var react_2 = require("react");
var utils_1 = require("@akashnetwork/ui/utils");
var next_themes_1 = require("next-themes");
var xterm_1 = require("xterm");
var xterm_addon_fit_1 = require("xterm-addon-fit");
var copyClipboard_1 = require("@src/utils/copyClipboard");
var XTerm = function (props) {
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    /**
     * The ref for the containing element.
     */
    var terminalEleRef = (0, react_1.useRef)(null);
    /**
     * XTerm.js Terminal object.
     */
    var terminalRef = (0, react_1.useRef)(null);
    react_2.default.useImperativeHandle(props.customRef, function () { return ({
        write: function (data, callback) { var _a; return (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.write(data, callback); },
        loadAddon: function (addon) { var _a; return (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.loadAddon(addon); },
        clear: function () { var _a; return (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.clear(); },
        reset: function () { var _a; return (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.reset(); },
        focus: function () { var _a; return (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.focus(); }
        // TODO more commands
    }); });
    (0, react_1.useEffect)(function () {
        // Setup the XTerm terminal.
        terminalRef.current = new xterm_1.Terminal(__assign(__assign({}, props.options), { theme: {
                background: resolvedTheme === "dark" ? "#1e1e1e" : "white",
                foreground: resolvedTheme === "dark" ? "white" : "black",
                cursor: resolvedTheme === "dark" ? "white" : "black",
                cursorAccent: resolvedTheme === "dark" ? "#1e1e1e" : "white",
                selectionBackground: resolvedTheme === "dark" ? "white" : "black",
                selectionForeground: resolvedTheme === "dark" ? "black" : "white",
                selectionInactiveBackground: resolvedTheme === "dark" ? "white" : "black"
            }, cursorBlink: true }));
        terminalRef.current.attachCustomKeyEventHandler(function (keyEvent) {
            var _a;
            // Handle pasting with ctrl or cmd + v
            if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyV" && keyEvent.type === "keydown") {
                if (props.onTerminalPaste) {
                    navigator.clipboard.readText().then(function (value) { return props.onTerminalPaste && props.onTerminalPaste(value); }, function (err) {
                        console.error("Async: Could not read text from clipboard: ", err);
                    });
                }
            }
            // Handle pasting with ctrl or cmd + c
            if ((keyEvent.ctrlKey || keyEvent.metaKey) && keyEvent.code === "KeyC" && keyEvent.type === "keydown") {
                var selection = (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.getSelection();
                if (selection) {
                    (0, copyClipboard_1.copyTextToClipboard)(selection);
                    return false;
                }
            }
            return true;
        });
        var fitAddon = new xterm_addon_fit_1.FitAddon();
        terminalRef.current.loadAddon(fitAddon);
        // Load addons if the prop exists.
        if (props.addons) {
            props.addons.forEach(function (addon) {
                var _a;
                (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.loadAddon(addon);
            });
        }
        // Add Custom Key Event Handler
        if (props.customKeyEventHandler) {
            terminalRef.current.attachCustomKeyEventHandler(props.customKeyEventHandler);
        }
        // Open terminal
        terminalRef.current.open(terminalEleRef.current);
        fitAddon.fit();
        return function () {
            var _a;
            // When the component unmounts dispose of the terminal and all of its listeners.
            (_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.dispose();
        };
    }, []);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onBinary && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onBinary(props.onBinary))); }, [props.onBinary]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onCursorMove && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onCursorMove(props.onCursorMove))); }, [props.onCursorMove]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onData && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onData(props.onData))); }, [props.onData]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onKey && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onKey(props.onKey))); }, [props.onKey]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onLineFeed && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onLineFeed(props.onLineFeed))); }, [props.onLineFeed]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onScroll && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onScroll(props.onScroll))); }, [props.onScroll]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onSelectionChange && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onSelectionChange(props.onSelectionChange))); }, [props.onSelectionChange]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onRender && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onRender(props.onRender))); }, [props.onRender]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onResize && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onResize(props.onResize))); }, [props.onResize]);
    (0, react_1.useEffect)(function () { var _a; return disposable(props.onTitleChange && ((_a = terminalRef.current) === null || _a === void 0 ? void 0 : _a.onTitleChange(props.onTitleChange))); }, [props.onTitleChange]);
    return (<div 
    // sx={{ height: "100%", "& .terminal": { height: "100%" } }}
    className={(0, utils_1.cn)(props.className, "h-full [&>.terminal]:h-full")} ref={terminalEleRef}/>);
};
exports.default = XTerm;
function disposable(value) {
    if (!value)
        return;
    return function () { return value.dispose(); };
}
