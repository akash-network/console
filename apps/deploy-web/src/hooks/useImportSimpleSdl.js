"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useImportSimpleSdl = useImportSimpleSdl;
var react_1 = require("react");
var sdlImport_1 = require("@src/utils/sdl/sdlImport");
function useImportSimpleSdl(sdl) {
    return (0, react_1.useMemo)(function () {
        if (!sdl)
            return [];
        try {
            return (0, sdlImport_1.importSimpleSdl)(sdl);
        }
        catch (error) {
            console.error("Failed to parse SDL:", error);
            return [];
        }
    }, [sdl]);
}
