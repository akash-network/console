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
exports.UserSettingsForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var next_seo_1 = require("next-seo");
var zod_1 = require("zod");
var FormPaper_1 = require("@src/components/sdl/FormPaper");
var LabelValue_1 = require("@src/components/shared/LabelValue");
var UserProfileLayout_1 = require("@src/components/user/UserProfileLayout");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useSaveSettings_1 = require("@src/queries/useSaveSettings");
var Layout_1 = require("../layout/Layout");
var formSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .min(3, "Username must be at least 3 characters long")
        .max(40, "Username must be at most 40 characters long")
        .regex(/^[a-zA-Z0-9_-]*$/, "Username can only contain letters, numbers, dashes and underscores"),
    subscribedToNewsletter: zod_1.z.boolean().optional(),
    bio: zod_1.z.string().optional(),
    youtubeUsername: zod_1.z.string().optional(),
    twitterUsername: zod_1.z.string().optional(),
    githubUsername: zod_1.z.string().optional()
});
var UserSettingsForm = function (_a) {
    var user = _a.user;
    var _b = (0, ServicesProvider_1.useServices)(), consoleApiHttpClient = _b.consoleApiHttpClient, analyticsService = _b.analyticsService;
    var _c = (0, react_1.useState)(false), isCheckingAvailability = _c[0], setIsCheckingAvailability = _c[1];
    var _d = (0, react_1.useState)(null), isAvailable = _d[0], setIsAvailable = _d[1];
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            username: "",
            subscribedToNewsletter: false,
            bio: "",
            youtubeUsername: "",
            twitterUsername: "",
            githubUsername: ""
        }
    });
    var getValues = form.getValues, register = form.register, handleSubmit = form.handleSubmit, setValue = form.setValue, control = form.control, watch = form.watch, _e = form.formState, isDirty = _e.isDirty, errors = _e.errors;
    var _f = (0, useSaveSettings_1.useSaveSettings)(), saveSettings = _f.mutate, isSaving = _f.isPending;
    var username = watch().username;
    var isFormDisabled = isSaving;
    var canSave = !isFormDisabled && isDirty && isAvailable !== false;
    (0, react_1.useEffect)(function () {
        if (user) {
            setValue("username", user.username || "");
            setValue("subscribedToNewsletter", user.subscribedToNewsletter);
            setValue("bio", user.bio);
            setValue("youtubeUsername", user.youtubeUsername);
            setValue("twitterUsername", user.twitterUsername);
            setValue("githubUsername", user.githubUsername);
        }
    }, [user === null || user === void 0 ? void 0 : user.username, user === null || user === void 0 ? void 0 : user.subscribedToNewsletter, user === null || user === void 0 ? void 0 : user.bio, user === null || user === void 0 ? void 0 : user.youtubeUsername, user === null || user === void 0 ? void 0 : user.twitterUsername, user === null || user === void 0 ? void 0 : user.githubUsername]);
    (0, react_1.useEffect)(function () {
        if (user && username && username.length >= 3 && username.length <= 40 && username !== user.username) {
            var timeoutId_1 = setTimeout(function () { return __awaiter(void 0, void 0, void 0, function () {
                var response;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            setIsCheckingAvailability(true);
                            return [4 /*yield*/, consoleApiHttpClient.get("/user/checkUsernameAvailability/".concat(username))];
                        case 1:
                            response = _a.sent();
                            setIsCheckingAvailability(false);
                            setIsAvailable(response.data.isAvailable);
                            return [2 /*return*/];
                    }
                });
            }); }, 500);
            return function () { return clearTimeout(timeoutId_1); };
        }
        else {
            setIsAvailable(null);
        }
    }, [user === null || user === void 0 ? void 0 : user.username, username]);
    function onSubmit() {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                saveSettings(getValues());
                analyticsService.track("user_settings_save", {
                    category: "settings",
                    label: "Save user settings"
                });
                return [2 /*return*/];
            });
        });
    }
    return (<Layout_1.default>
      <next_seo_1.NextSeo title={user === null || user === void 0 ? void 0 : user.username}/>
      <UserProfileLayout_1.UserProfileLayout page="settings" username={user.username} bio={user.bio}>
        <FormPaper_1.FormPaper>
          <components_1.Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)}>
              <LabelValue_1.LabelValue label="Email" value={user.email}/>
              <LabelValue_1.LabelValue label="Username" value={<>
                    <div className="flex items-center">
                      <components_1.FormField name="username" control={control} render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} autoFocus className="mr-2" disabled={isFormDisabled}/>;
            }}/>
                      {isCheckingAvailability && <components_1.Spinner size="small"/>}
                      <span className="flex flex-shrink-0 items-center whitespace-nowrap text-xs">
                        {!isCheckingAvailability && isAvailable && (<>
                            <iconoir_react_1.CheckCircle className="text-green-600"/>
                            &nbsp;Username is available
                          </>)}
                        {!isCheckingAvailability && isAvailable === false && (<>
                            <md_1.MdHighlightOff className="text-destructive"/>
                            &nbsp;Username is not available
                          </>)}
                      </span>
                    </div>
                    {errors.username && (<components_1.Alert className="mt-2" variant="destructive">
                        {errors.username.message}
                      </components_1.Alert>)}
                  </>}/>
              <LabelValue_1.LabelValue label="Subscribed to newsletter" value={<div className="flex items-center">
                    <react_hook_form_1.Controller name="subscribedToNewsletter" control={control} render={function (_a) {
            var field = _a.field;
            return <components_1.Switch checked={field.value} onCheckedChange={field.onChange}/>;
        }}/>
                  </div>}/>
              <LabelValue_1.LabelValue label="Bio" value={<components_1.Textarea disabled={isFormDisabled} rows={4} inputClassName="w-full" {...register("bio")}/>}/>

              <LabelValue_1.LabelValue label="Youtube" value={<components_1.FormField name="youtubeUsername" control={control} render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://www.youtube.com/c/"/>;
        }}/>}/>
              <LabelValue_1.LabelValue label="X" value={<components_1.FormField name="twitterUsername" control={control} render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://x.com/"/>;
        }}/>}/>
              <LabelValue_1.LabelValue label="Github" value={<components_1.FormField name="githubUsername" control={control} render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} disabled={isFormDisabled} className="w-full" placeholder="https://github.com/"/>;
        }}/>}/>

              <components_1.Button type="submit" disabled={!canSave || isSaving}>
                {isSaving ? <components_1.Spinner size="small"/> : "Save"}
              </components_1.Button>
            </form>
          </components_1.Form>
        </FormPaper_1.FormPaper>
      </UserProfileLayout_1.UserProfileLayout>
    </Layout_1.default>);
};
exports.UserSettingsForm = UserSettingsForm;
