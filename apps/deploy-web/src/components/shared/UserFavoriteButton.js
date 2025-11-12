"use strict";
"use client";
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
exports.UserFavoriteButton = void 0;
var react_1 = require("react");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var notistack_1 = require("notistack");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var MustConnectModal_1 = require("./MustConnectModal");
var UserFavoriteButton = function (_a) {
    var _b;
    var id = _a.id, _isFavorite = _a.isFavorite, onAddFavorite = _a.onAddFavorite, onRemoveFavorite = _a.onRemoveFavorite;
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var _c = (0, react_1.useState)(_isFavorite), isFavorite = _c[0], setIsFavorite = _c[1];
    var _d = (0, useTemplateQuery_1.useAddFavoriteTemplate)(id), addFavorite = _d.mutate, isAdding = _d.isPending;
    var _e = (0, useTemplateQuery_1.useRemoveFavoriteTemplate)(id), removeFavorite = _e.mutate, isRemoving = _e.isPending;
    var _f = (0, react_1.useState)(false), showMustConnectModal = _f[0], setShowMustConnectModal = _f[1];
    var isSaving = isAdding || isRemoving;
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var onFavoriteClick = function () { return __awaiter(void 0, void 0, void 0, function () {
        var error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 5, , 6]);
                    if (isSaving)
                        return [2 /*return*/];
                    if (!user) {
                        setShowMustConnectModal(true);
                        return [2 /*return*/];
                    }
                    if (!isFavorite) return [3 /*break*/, 2];
                    return [4 /*yield*/, removeFavorite()];
                case 1:
                    _a.sent();
                    onRemoveFavorite && onRemoveFavorite();
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, addFavorite()];
                case 3:
                    _a.sent();
                    onAddFavorite && onAddFavorite();
                    _a.label = 4;
                case 4:
                    setIsFavorite(function (prev) { return !prev; });
                    return [3 /*break*/, 6];
                case 5:
                    error_1 = _a.sent();
                    console.log(error_1);
                    enqueueSnackbar(<components_1.Snackbar title="An error has occured." iconVariant="error"/>, {
                        variant: "error"
                    });
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    return (<>
      {showMustConnectModal && <MustConnectModal_1.MustConnectModal message="To add template favorites" onClose={function () { return setShowMustConnectModal(false); }}/>}
      <components_1.Button size="icon" onClick={onFavoriteClick} variant="ghost" className={(0, utils_1.cn)((_b = {}, _b["text-primary"] = isFavorite, _b), "text-xl")}>
        {isSaving ? <components_1.Spinner size="small"/> : isFavorite ? <md_1.MdStar /> : <md_1.MdStarOutline />}
      </components_1.Button>
    </>);
};
exports.UserFavoriteButton = UserFavoriteButton;
