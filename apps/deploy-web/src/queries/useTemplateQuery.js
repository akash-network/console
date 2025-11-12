"use strict";
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
exports.useUserTemplates = useUserTemplates;
exports.useUserFavoriteTemplates = useUserFavoriteTemplates;
exports.useTemplate = useTemplate;
exports.useSaveUserTemplate = useSaveUserTemplate;
exports.useDeleteTemplate = useDeleteTemplate;
exports.useAddFavoriteTemplate = useAddFavoriteTemplate;
exports.useRemoveFavoriteTemplate = useRemoveFavoriteTemplate;
exports.useTemplates = useTemplates;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var react_query_1 = require("@tanstack/react-query");
var notistack_1 = require("notistack");
var ServicesProvider_1 = require("@src/context/ServicesProvider/ServicesProvider");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var queryKeys_1 = require("./queryKeys");
function useUserTemplates(username, options) {
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getUserTemplatesKey(username), queryFn: function () { return consoleApiHttpClient.get("/user/templates/".concat(username)).then(function (response) { return response.data; }); } }, options));
}
function useUserFavoriteTemplates(options) {
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getUserFavoriteTemplatesKey((user === null || user === void 0 ? void 0 : user.sub) || ""), queryFn: function () { return consoleApiHttpClient.get("/user/favoriteTemplates").then(function (response) { return response.data; }); } }, options));
}
function useTemplate(id, options) {
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useQuery)(__assign({ queryKey: queryKeys_1.QueryKeys.getTemplateKey(id), queryFn: function () { return consoleApiHttpClient.get("/user/template/".concat(id)).then(function (response) { return response.data; }); } }, options));
}
function useSaveUserTemplate(options) {
    if (options === void 0) { options = {}; }
    var queryClient = (0, react_query_1.useQueryClient)();
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useMutation)({
        mutationFn: function (template) {
            return consoleApiHttpClient.post("/user/saveTemplate", {
                id: template.id,
                sdl: template.sdl,
                isPublic: template.isPublic,
                title: template.title,
                description: template.description,
                cpu: template.cpu,
                ram: template.ram,
                storage: template.storage
            });
        },
        onSuccess: function (_response, newTemplate) {
            var _a;
            queryClient.setQueryData(queryKeys_1.QueryKeys.getTemplateKey(_response.data), function (oldData) {
                return __assign(__assign({}, oldData), newTemplate);
            });
            (_a = options.onSuccess) === null || _a === void 0 ? void 0 : _a.call(options, _response.data);
        }
    });
}
function useDeleteTemplate(id) {
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var queryClient = (0, react_query_1.useQueryClient)();
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return consoleApiHttpClient.delete("/user/deleteTemplate/".concat(id)); },
        onSuccess: function () {
            if (user.username) {
                queryClient.setQueryData(queryKeys_1.QueryKeys.getUserTemplatesKey(user === null || user === void 0 ? void 0 : user.username), function (oldData) {
                    if (oldData === void 0) { oldData = []; }
                    return oldData.filter(function (t) { return t.id !== id; });
                });
            }
        }
    });
}
function useAddFavoriteTemplate(id) {
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return consoleApiHttpClient.post("/user/addFavoriteTemplate/".concat(id)); },
        onSuccess: function () {
            enqueueSnackbar(<components_1.Snackbar title="Favorite added!" iconVariant="success"/>, { variant: "success" });
        }
    });
}
function useRemoveFavoriteTemplate(id) {
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    return (0, react_query_1.useMutation)({
        mutationFn: function () { return consoleApiHttpClient.delete("/user/removeFavoriteTemplate/".concat(id)); },
        onSuccess: function () {
            enqueueSnackbar(<components_1.Snackbar title="Favorite removed" iconVariant="success"/>, { variant: "success" });
        }
    });
}
function getTemplates(templateService) {
    return __awaiter(this, void 0, void 0, function () {
        var response, categories, modifiedCategories, templates;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, templateService.findGroupedByCategory()];
                case 1:
                    response = _a.sent();
                    if (!response.data) {
                        return [2 /*return*/, { categories: [], templates: [] }];
                    }
                    categories = response.data.filter(function (x) { var _a; return !!((_a = x.templates) === null || _a === void 0 ? void 0 : _a.length); });
                    modifiedCategories = categories.map(function (category) {
                        var templatesWithCategory = category.templates.map(function (template) { return (__assign(__assign({}, template), { category: category.title })); });
                        return __assign(__assign({}, category), { templates: templatesWithCategory });
                    });
                    templates = modifiedCategories.flatMap(function (category) { return category.templates; });
                    return [2 /*return*/, { categories: modifiedCategories, templates: templates }];
            }
        });
    });
}
function useTemplates(options) {
    if (options === void 0) { options = {}; }
    var templateService = (0, ServicesProvider_1.useServices)().template;
    var query = (0, react_query_1.useQuery)(__assign(__assign({ queryKey: queryKeys_1.QueryKeys.getTemplatesKey(), queryFn: function () { return getTemplates(templateService); } }, options), { refetchInterval: 60000 * 2, refetchIntervalInBackground: false, refetchOnWindowFocus: false, refetchOnReconnect: false }));
    return (0, react_1.useMemo)(function () {
        var _a, _b;
        return ({
            isLoading: query.isFetching,
            categories: ((_a = query.data) === null || _a === void 0 ? void 0 : _a.categories) || [],
            templates: ((_b = query.data) === null || _b === void 0 ? void 0 : _b.templates) || []
        });
    }, [query.isFetching, query.data]);
}
