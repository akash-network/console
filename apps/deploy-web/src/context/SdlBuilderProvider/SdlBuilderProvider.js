"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withSdlBuilder = exports.useSdlBuilder = exports.SdlBuilderProvider = void 0;
var react_1 = require("react");
var data_1 = require("@src/utils/sdl/data");
var SdlContext = react_1.default.createContext(undefined);
var COMPONENTS_SETS = {
    ssh: ["command", "service-count", "ssh-toggle", "yml-editor", "yml-uploader"],
    "ssh-toggled": ["ssh"],
    default: ["ssh", "ssh-toggle"]
};
var SdlBuilderProvider = function (_a) {
    var children = _a.children, imageSource = _a.imageSource, props = __rest(_a, ["children", "imageSource"]);
    var inputHiddenComponents = ("hiddenComponents" in props && props.hiddenComponents) || ("componentsSet" in props && COMPONENTS_SETS[props.componentsSet]) || COMPONENTS_SETS.default;
    var imageList = imageSource === "ssh-vms" ? data_1.sshVmDistros : undefined;
    var _b = (0, react_1.useState)(new Set(inputHiddenComponents || [])), hiddenComponents = _b[0], setHiddenComponents = _b[1];
    var toggleCmp = (0, react_1.useCallback)(function (component) {
        setHiddenComponents(function (prev) {
            var next = new Set(prev);
            next.has(component) ? next.delete(component) : next.add(component);
            return next;
        });
    }, [setHiddenComponents]);
    var hasComponent = (0, react_1.useCallback)(function (component) { return !hiddenComponents.has(component); }, [hiddenComponents]);
    var context = (0, react_1.useMemo)(function () { return ({
        hasComponent: hasComponent,
        toggleCmp: toggleCmp,
        imageList: imageList
    }); }, [imageList, hasComponent, toggleCmp]);
    return <SdlContext.Provider value={context}>{children}</SdlContext.Provider>;
};
exports.SdlBuilderProvider = SdlBuilderProvider;
var useSdlBuilder = function () {
    var context = react_1.default.useContext(SdlContext);
    if (!context) {
        throw new Error("useSdlBuilder must be used within a SdlContext");
    }
    return context;
};
exports.useSdlBuilder = useSdlBuilder;
var withSdlBuilder = function (options) {
    if (options === void 0) { options = {}; }
    return function wrapWithSdlBuilder(Component) {
        return function WrappedComponent(props) {
            return (<exports.SdlBuilderProvider {...options}>
          <Component {...props}/>
        </exports.SdlBuilderProvider>);
        };
    };
};
exports.withSdlBuilder = withSdlBuilder;
