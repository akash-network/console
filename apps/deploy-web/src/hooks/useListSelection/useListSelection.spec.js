"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var lodash_1 = require("lodash");
var useListSelection_1 = require("./useListSelection");
var react_1 = require("@testing-library/react");
var expectSelectedItems = function (actualIds, expectedIds) {
    expect(actualIds.length).toBe(expectedIds.length);
    expect(actualIds).toEqual(expect.arrayContaining(expectedIds));
};
var testSelection = function (config) { return __awaiter(void 0, void 0, void 0, function () {
    var result;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                result = setup();
                config.clicks.forEach(function (_a) {
                    var id = _a.id, isShiftPressed = _a.isShiftPressed;
                    (0, react_1.act)(function () {
                        result.current.selectItem({ id: id, isShiftPressed: isShiftPressed });
                    });
                });
                return [4 /*yield*/, (0, react_1.waitFor)(function () {
                        expectSelectedItems(result.current.selectedItemIds, config.expectedItems);
                    })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
describe(useListSelection_1.useListSelection.name, function () {
    it("should not explode for an empty list", function () {
        var result = setup({ ids: [] });
        expect(result.current.selectedItemIds).toEqual([]);
    });
    it("can set a single item as selected", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [{ id: 2, isShiftPressed: false }],
                        expectedItems: [2]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can select multiple items, toggling back and forth", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 3, isShiftPressed: false },
                            { id: 4, isShiftPressed: false },
                            { id: 3, isShiftPressed: false }
                        ],
                        expectedItems: [2, 4]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can shift-select first item", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [{ id: 2, isShiftPressed: true }],
                        expectedItems: [2]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can shift-select items down", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 4, isShiftPressed: true }
                        ],
                        expectedItems: [2, 3, 4]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can shift-select items up", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 4, isShiftPressed: false },
                            { id: 2, isShiftPressed: true }
                        ],
                        expectedItems: [2, 3, 4]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can shift-select down and then up", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 4, isShiftPressed: true },
                            { id: 0, isShiftPressed: true }
                        ],
                        expectedItems: [0, 1, 2, 3, 4]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can shift-select up and then down", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 0, isShiftPressed: true },
                            { id: 4, isShiftPressed: true }
                        ],
                        expectedItems: [0, 1, 2, 3, 4]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can deselect the whole range up", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 4, isShiftPressed: true },
                            { id: 2, isShiftPressed: true }
                        ],
                        expectedItems: []
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can deselect the whole range down", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 4, isShiftPressed: false },
                            { id: 2, isShiftPressed: true },
                            { id: 4, isShiftPressed: true }
                        ],
                        expectedItems: []
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can mark even more items down", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 2, isShiftPressed: false },
                            { id: 4, isShiftPressed: true },
                            { id: 0, isShiftPressed: true },
                            { id: 6, isShiftPressed: true }
                        ],
                        expectedItems: [0, 1, 2, 3, 4, 5, 6]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
    it("can mark even more items up", function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, testSelection({
                        clicks: [
                            { id: 4, isShiftPressed: false },
                            { id: 6, isShiftPressed: true },
                            { id: 2, isShiftPressed: true },
                            { id: 0, isShiftPressed: true }
                        ],
                        expectedItems: [0, 1, 2, 3, 4, 5, 6]
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); });
});
function setup(_a) {
    var _b = _a === void 0 ? { ids: (0, lodash_1.range)(0, 10) } : _a, ids = _b.ids;
    var result = (0, react_1.renderHook)(function () { return (0, useListSelection_1.useListSelection)({ ids: ids }); }).result;
    return result;
}
