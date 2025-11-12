"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useListSelection = void 0;
var react_1 = require("react");
var intersection_1 = require("lodash/intersection");
var uniq_1 = require("lodash/uniq");
var useListSelection = function (_a) {
    var ids = _a.ids;
    var _b = (0, react_1.useState)([]), selectedItemIds = _b[0], setSelectedItemIds = _b[1];
    var _c = (0, react_1.useState)(null), intervalSelectionAnchor = _c[0], setIntervalSelectionAnchor = _c[1];
    var _d = (0, react_1.useState)([]), lastIntervalSelectionIds = _d[0], setLastIntervalSelectionIds = _d[1];
    var indexOfId = (0, react_1.useCallback)(function (id) {
        return ids === null || ids === void 0 ? void 0 : ids.findIndex(function (currentId) { return currentId === id; });
    }, [ids]);
    var isBetweenIds = (0, react_1.useCallback)(function (id, idA, idB) {
        var idIndex = indexOfId(id);
        var idAIndex = indexOfId(idA);
        var idBIndex = indexOfId(idB);
        return (idIndex !== -1 && idAIndex !== -1 && idBIndex !== -1 && ((idAIndex <= idIndex && idIndex <= idBIndex) || (idAIndex >= idIndex && idIndex >= idBIndex)));
    }, [indexOfId]);
    var itemsBetween = (0, react_1.useCallback)(function (idA, idB) {
        return ids.filter(function (currentId) { return isBetweenIds(currentId, idA, idB); });
    }, [ids, isBetweenIds]);
    var toggleSingleSelection = (0, react_1.useCallback)(function (id) {
        setSelectedItemIds(function (prev) {
            var isAdding = !prev.includes(id);
            if (isAdding) {
                setIntervalSelectionAnchor(id);
            }
            return isAdding ? __spreadArray(__spreadArray([], prev, true), [id], false) : prev.filter(function (x) { return x !== id; });
        });
    }, []);
    var changeMultipleSelection = (0, react_1.useCallback)(function (id) {
        var newRange = itemsBetween(id, intervalSelectionAnchor);
        if (id === intervalSelectionAnchor && lastIntervalSelectionIds.length > 0) {
            setSelectedItemIds(function (prev) { return prev.filter(function (x) { return !lastIntervalSelectionIds.includes(x); }); });
            setLastIntervalSelectionIds([]);
            return;
        }
        setSelectedItemIds(function (prev) { return (0, uniq_1.default)(__spreadArray(__spreadArray([], prev, true), newRange, true)); });
        setLastIntervalSelectionIds(newRange);
    }, [intervalSelectionAnchor, itemsBetween, lastIntervalSelectionIds]);
    var selectItem = (0, react_1.useCallback)(function (_a) {
        var id = _a.id, isShiftPressed = _a.isShiftPressed;
        if (intervalSelectionAnchor && isShiftPressed) {
            changeMultipleSelection(id);
        }
        else {
            toggleSingleSelection(id);
        }
    }, [intervalSelectionAnchor, changeMultipleSelection, toggleSingleSelection]);
    var clearSelection = (0, react_1.useCallback)(function () {
        setSelectedItemIds([]);
    }, []);
    var validSelectedItemIds = (0, react_1.useMemo)(function () {
        return (0, intersection_1.default)(ids, selectedItemIds);
    }, [ids, selectedItemIds]);
    return (0, react_1.useMemo)(function () { return ({
        selectedItemIds: validSelectedItemIds,
        selectItem: selectItem,
        clearSelection: clearSelection,
        setSelectedItemIds: setSelectedItemIds
    }); }, [validSelectedItemIds, selectItem, clearSelection]);
};
exports.useListSelection = useListSelection;
