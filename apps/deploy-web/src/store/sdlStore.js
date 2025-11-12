"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var jotai_1 = require("jotai");
var deploySdl = (0, jotai_1.atom)(null);
var sdlBuilderSdl = (0, jotai_1.atom)(null);
var rentGpuSdl = (0, jotai_1.atom)(null);
var selectedSdlEditMode = (0, jotai_1.atom)("yaml");
exports.default = {
    deploySdl: deploySdl,
    sdlBuilderSdl: sdlBuilderSdl,
    rentGpuSdl: rentGpuSdl,
    selectedSdlEditMode: selectedSdlEditMode
};
