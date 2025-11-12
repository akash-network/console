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
exports.EditDescriptionForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var notistack_1 = require("notistack");
var zod_2 = require("zod");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var FormPaper_1 = require("./FormPaper");
var formSchema = zod_2.z.object({
    description: zod_2.z.string().min(3, "Description must be at least 3 characters long")
});
var EditDescriptionForm = function (_a) {
    var id = _a.id, description = _a.description, onCancel = _a.onCancel, onSave = _a.onSave;
    var formRef = (0, react_1.useRef)(null);
    var _b = (0, react_1.useState)(false), isSaving = _b[0], setIsSaving = _b[1];
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var consoleApiHttpClient = (0, ServicesProvider_1.useServices)().consoleApiHttpClient;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            description: description || ""
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control;
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setIsSaving(true);
                    return [4 /*yield*/, consoleApiHttpClient.post("/user/saveTemplateDesc", {
                            id: id,
                            description: data.description
                        })];
                case 1:
                    _a.sent();
                    enqueueSnackbar(<components_1.Snackbar title="Description saved!" iconVariant="success"/>, {
                        variant: "success"
                    });
                    onSave(data.description);
                    return [2 /*return*/];
            }
        });
    }); };
    return (<FormPaper_1.FormPaper className="mt-4">
      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
          <components_1.FormField control={control} name={"description"} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem>
                <components_1.Textarea label="Description" aria-label="Description" rows={10} placeholder="Write your guide on how to use this template here!" inputClassName="mt-2 w-full px-4 py-2 text-sm" value={field.value} spellCheck={false} onChange={field.onChange}/>
                <components_1.FormMessage />
              </components_1.FormItem>);
        }}/>

          <div className="mt-2 flex items-center justify-end space-x-4">
            <components_1.Button onClick={onCancel} variant="ghost">
              Cancel
            </components_1.Button>
            <components_1.Button variant="default" type="submit">
              {isSaving ? <components_1.Spinner size="small"/> : "Save"}
            </components_1.Button>
          </div>
        </form>
      </components_1.Form>
    </FormPaper_1.FormPaper>);
};
exports.EditDescriptionForm = EditDescriptionForm;
