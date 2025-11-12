"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsIdAtom = void 0;
var utils_1 = require("jotai/utils");
var SETTINGS_ID_KEY = "akashSettingsId";
exports.settingsIdAtom = (0, utils_1.atomWithStorage)(SETTINGS_ID_KEY, null, undefined, {
    getOnInit: true
});
