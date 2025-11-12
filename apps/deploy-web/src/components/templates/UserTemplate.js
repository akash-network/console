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
exports.UserTemplate = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var link_1 = require("next/link");
var navigation_1 = require("next/navigation");
var EditDescriptionForm_1 = require("@src/components/sdl/EditDescriptionForm");
var LeaseSpecDetail_1 = require("@src/components/shared/LeaseSpecDetail");
var Title_1 = require("@src/components/shared/Title");
var UserFavoriteButton_1 = require("@src/components/shared/UserFavoriteButton");
var deploy_config_1 = require("@src/config/deploy.config");
var useCustomUser_1 = require("@src/hooks/useCustomUser");
var useShortText_1 = require("@src/hooks/useShortText");
var useTemplateQuery_1 = require("@src/queries/useTemplateQuery");
var analytics_service_1 = require("@src/services/analytics/analytics.service");
var sdlStore_1 = require("@src/store/sdlStore");
var route_steps_type_1 = require("@src/types/route-steps.type");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var unitUtils_1 = require("@src/utils/unitUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var Layout_1 = require("../layout/Layout");
var CustomNextSeo_1 = require("../shared/CustomNextSeo");
var UserTemplate = function (_a) {
    var id = _a.id, template = _a.template;
    var _b = (0, react_1.useState)(""), description = _b[0], setDescription = _b[1];
    var _c = (0, react_1.useState)(false), isShowingDelete = _c[0], setIsShowingDelete = _c[1];
    var _d = (0, react_1.useState)(false), isEditingDescription = _d[0], setIsEditingDescription = _d[1];
    var user = (0, useCustomUser_1.useCustomUser)().user;
    var _e = (0, useTemplateQuery_1.useDeleteTemplate)(id), deleteTemplate = _e.mutate, isDeleting = _e.isPending;
    var isCurrentUserTemplate = (user === null || user === void 0 ? void 0 : user.sub) === template.userId;
    var _ram = (0, unitUtils_1.bytesToShrink)(template.ram);
    var _storage = (0, unitUtils_1.bytesToShrink)(template.storage);
    var router = (0, navigation_1.useRouter)();
    var _f = (0, jotai_1.useAtom)(sdlStore_1.default.deploySdl), setDeploySdl = _f[1];
    (0, react_1.useEffect)(function () {
        var desc = template.description || "";
        setDescription(desc);
    }, []);
    var onDeleteTemplate = function () { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, deleteTemplate()];
                case 1:
                    _a.sent();
                    analytics_service_1.analyticsService.track("deploy_sdl", {
                        category: "sdl_builder",
                        label: "Delete SDL template from detail"
                    });
                    router.replace(urlUtils_1.UrlService.userProfile(template.username));
                    return [2 /*return*/];
            }
        });
    }); };
    var onDeleteClose = function () {
        setIsShowingDelete(false);
    };
    var onDescriptionSave = function (desc) {
        setDescription(desc);
        setIsEditingDescription(false);
        analytics_service_1.analyticsService.track("save_sdl_description", {
            category: "sdl_builder",
            label: "Save SDL description"
        });
    };
    return (<Layout_1.default>
      <CustomNextSeo_1.CustomNextSeo title={"".concat(template.title)} url={"".concat(urlUtils_1.domainName).concat(urlUtils_1.UrlService.template(id))} description={(0, useShortText_1.getShortText)(template.description || "", 140)}/>

      <components_1.Popup fullWidth variant="custom" actions={[
            {
                label: "Close",
                color: "primary",
                variant: "text",
                side: "left",
                onClick: onDeleteClose
            },
            {
                label: "Confirm",
                color: "secondary",
                variant: "default",
                side: "right",
                isLoading: isDeleting,
                onClick: onDeleteTemplate
            }
        ]} onClose={onDeleteClose} maxWidth="xs" enableCloseOnBackdropClick open={isShowingDelete} title="Delete template">
        Are you sure you want to delete template: "{template.title}"?
      </components_1.Popup>

      <div className="mb-4 flex items-baseline">
        <Title_1.Title className="m-0">{template.title}</Title_1.Title>
        &nbsp;&nbsp;by&nbsp;
        <span onClick={function () {
            analytics_service_1.analyticsService.track("click_sdl_profile", {
                category: "sdl_builder",
                label: "Click on SDL user profile in template detail"
            });
        }}>
          <link_1.default href={urlUtils_1.UrlService.userProfile(template.username)}>{template.username}</link_1.default>
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <components_1.Button onClick={function () {
            analytics_service_1.analyticsService.track("deploy_sdl", {
                category: "sdl_builder",
                label: "Deploy SDL from template detail"
            });
            setDeploySdl({
                title: "",
                category: "",
                code: deploy_config_1.USER_TEMPLATE_CODE,
                description: "",
                content: template.sdl
            });
            router.push(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.editDeployment }));
        }}>
          Deploy
          <iconoir_react_1.Rocket className="ml-2 rotate-45 text-sm"/>
        </components_1.Button>

        <link_1.default href={urlUtils_1.UrlService.sdlBuilder(template.id)} className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text" }))} onClick={function () {
            analytics_service_1.analyticsService.track("click_edit_sdl_template", {
                category: "sdl_builder",
                label: "Click on edit SDL template"
            });
        }}>
          Edit
        </link_1.default>

        <UserFavoriteButton_1.UserFavoriteButton isFavorite={template.isFavorite} id={id} onAddFavorite={function () {
            analytics_service_1.analyticsService.track("add_sdl_favorite", {
                category: "sdl_builder",
                label: "Add SDL to favorites"
            });
        }} onRemoveFavorite={function () {
            analytics_service_1.analyticsService.track("remove_sdl_favorite", {
                category: "sdl_builder",
                label: "Remove SDL from favorites"
            });
        }}/>

        {isCurrentUserTemplate && (<components_1.Button size="icon" variant="ghost" onClick={function () { return setIsShowingDelete(true); }}>
            <iconoir_react_1.Bin />
          </components_1.Button>)}
      </div>

      <div className="mt-4 flex flex-wrap items-center space-x-6">
        <LeaseSpecDetail_1.LeaseSpecDetail type="cpu" value={template.cpu / 1000}/>
        <LeaseSpecDetail_1.LeaseSpecDetail type="ram" value={"".concat((0, mathHelpers_1.roundDecimal)(_ram.value, 1), " ").concat(_ram.unit)}/>
        <LeaseSpecDetail_1.LeaseSpecDetail type="storage" value={"".concat((0, mathHelpers_1.roundDecimal)(_storage.value, 1), " ").concat(_storage.unit)}/>
      </div>

      {isEditingDescription ? (<EditDescriptionForm_1.EditDescriptionForm id={id} description={description} onCancel={function () { return setIsEditingDescription(false); }} onSave={onDescriptionSave}/>) : (<components_1.Card className="relative mt-4 whitespace-pre-wrap">
          <components_1.CardContent className="p-4">
            {isCurrentUserTemplate && (<div className="absolute right-2 top-2">
                <components_1.Button onClick={function () { return setIsEditingDescription(true); }} size="icon" variant="ghost">
                  <iconoir_react_1.Edit />
                </components_1.Button>
              </div>)}

            {description ? description : <p className="text-sm text-muted-foreground">No description...</p>}
          </components_1.CardContent>
        </components_1.Card>)}
    </Layout_1.default>);
};
exports.UserTemplate = UserTemplate;
