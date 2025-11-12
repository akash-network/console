"use strict";
"use client";
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
exports.ProviderMultiSelect = exports.EditProviderForm = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var zod_1 = require("@hookform/resolvers/zod");
var iconoir_react_1 = require("iconoir-react");
var nanoid_1 = require("nanoid");
var FormPaper_1 = require("@src/components/sdl/FormPaper");
var WalletProvider_1 = require("@src/context/WalletProvider");
var providerAttributes_1 = require("@src/types/providerAttributes");
var data_1 = require("@src/utils/providerAttributes/data");
var helpers_1 = require("@src/utils/providerAttributes/helpers");
var TransactionMessageData_1 = require("@src/utils/TransactionMessageData");
var EditProviderForm = function (_a) {
    var provider = _a.provider, providerAttributesSchema = _a.providerAttributesSchema;
    var _b = (0, react_1.useState)(false), isInit = _b[0], setIsInit = _b[1];
    var _c = (0, react_1.useState)(null), error = _c[0], setError = _c[1];
    var formRef = (0, react_1.useRef)(null);
    var signAndBroadcastTx = (0, WalletProvider_1.useWallet)().signAndBroadcastTx;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: __assign({}, data_1.defaultProviderAttributes),
        resolver: (0, zod_1.zodResolver)(providerAttributes_1.providerAttributesFormValuesSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, watch = form.watch, setValue = form.setValue, formState = form.formState;
    var _d = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "unknown-attributes",
        keyName: "id"
    }), unknownAttributes = _d.fields, removeUnkownAttribute = _d.remove, appendUnkownAttribute = _d.append;
    var _unknownAttributes = watch()["unknown-attributes"];
    (0, react_1.useEffect)(function () {
        var getProviderAttributeTextValue = function (key) {
            var _a, _b;
            return ((_b = (_a = provider === null || provider === void 0 ? void 0 : provider.attributes) === null || _a === void 0 ? void 0 : _a.find(function (x) { return x.key === key; })) === null || _b === void 0 ? void 0 : _b.value) || "";
        };
        var getAttributeOptionValue = function (key) {
            var _a;
            var _key = providerAttributesSchema[key].key;
            var possibleValues = providerAttributesSchema[key].values;
            var attributeValue = (_a = provider === null || provider === void 0 ? void 0 : provider.attributes) === null || _a === void 0 ? void 0 : _a.find(function (x) { return x.key === _key; });
            return possibleValues.find(function (x) { return x.key === (attributeValue === null || attributeValue === void 0 ? void 0 : attributeValue.value); });
        };
        var getAttributeMultipleOptionValue = function (key) {
            var possibleValues = providerAttributesSchema[key].values;
            return possibleValues.filter(function (x) { var _a; return (_a = provider === null || provider === void 0 ? void 0 : provider.attributes) === null || _a === void 0 ? void 0 : _a.some(function (y) { return x.key === y.key; }); });
        };
        var getProviderAttributeValue = function (key) {
            var attribute = providerAttributesSchema[key];
            switch (attribute.type) {
                case "string":
                    return getProviderAttributeTextValue(key);
                case "number":
                    return parseInt(getProviderAttributeTextValue(key)) || "";
                case "boolean":
                    return getProviderAttributeTextValue(key) === "true";
                case "option":
                    return getAttributeOptionValue(key);
                case "multiple-option":
                    return getAttributeMultipleOptionValue(key);
                default:
                    return "";
            }
        };
        if (providerAttributesSchema && !isInit) {
            var unknownAttributes_1 = (0, helpers_1.getUnknownAttributes)((provider === null || provider === void 0 ? void 0 : provider.attributes) || [], providerAttributesSchema);
            setValue("host-uri", (provider === null || provider === void 0 ? void 0 : provider.hostUri) || "");
            setValue("host", getProviderAttributeValue("host"));
            setValue("website", getProviderAttributeValue("website"));
            setValue("email", getProviderAttributeValue("email"));
            setValue("organization", getProviderAttributeValue("organization"));
            setValue("status-page", getProviderAttributeValue("status-page"));
            setValue("location-region", getProviderAttributeValue("location-region"));
            setValue("country", getProviderAttributeValue("country"));
            setValue("city", getProviderAttributeValue("city"));
            setValue("timezone", getProviderAttributeValue("timezone"));
            setValue("location-type", getProviderAttributeValue("location-type"));
            setValue("hosting-provider", getProviderAttributeValue("hosting-provider"));
            setValue("hardware-cpu", getProviderAttributeValue("hardware-cpu"));
            setValue("hardware-cpu-arch", getProviderAttributeValue("hardware-cpu-arch"));
            setValue("hardware-gpu", getProviderAttributeValue("hardware-gpu"));
            setValue("hardware-gpu-model", getProviderAttributeValue("hardware-gpu-model"));
            setValue("hardware-disk", getProviderAttributeValue("hardware-disk"));
            setValue("feat-persistent-storage", getProviderAttributeValue("feat-persistent-storage"));
            setValue("feat-persistent-storage-type", getProviderAttributeValue("feat-persistent-storage-type"));
            setValue("hardware-memory", getProviderAttributeValue("hardware-memory"));
            setValue("network-provider", getProviderAttributeValue("network-provider"));
            setValue("network-speed-down", getProviderAttributeValue("network-speed-down"));
            setValue("network-speed-up", getProviderAttributeValue("network-speed-up"));
            setValue("tier", getProviderAttributeValue("tier"));
            setValue("feat-endpoint-custom-domain", getProviderAttributeValue("feat-endpoint-custom-domain"));
            setValue("workload-support-chia", getProviderAttributeValue("workload-support-chia"));
            setValue("workload-support-chia-capabilities", getProviderAttributeValue("workload-support-chia-capabilities"));
            setValue("feat-endpoint-ip", getProviderAttributeValue("feat-endpoint-ip"));
            setValue("unknown-attributes", unknownAttributes_1);
            setIsInit(true);
        }
    }, [providerAttributesSchema, isInit]);
    var onSubmit = function (data) { return __awaiter(void 0, void 0, void 0, function () {
        var attributes, message, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    attributes = (0, helpers_1.mapFormValuesToAttributes)(data, providerAttributesSchema);
                    message = TransactionMessageData_1.TransactionMessageData.getUpdateProviderMsg((provider === null || provider === void 0 ? void 0 : provider.owner) || "", data["host-uri"], attributes, {
                        email: data.email,
                        website: data.website || ""
                    });
                    return [4 /*yield*/, signAndBroadcastTx([message])];
                case 2:
                    _a.sent();
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    setError(error_1.message);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<components_1.Form {...form}>
      <form onSubmit={handleSubmit(onSubmit)} ref={formRef} autoComplete="off">
        <FormPaper_1.FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">General info</p>

          <components_1.FormField control={control} name="host-uri" render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="text" label="Host URI" tabIndex={0} value={field.value} className="mb-4" onChange={function (event) { return field.onChange(event.target.value || ""); }} endIcon={<components_1.CustomTooltip title="Host URI is the URI of the host that is running the provider. It is used to identify the provider.">
                    <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                  </components_1.CustomTooltip>}/>);
        }}/>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/** LEFT COLUMN */}
            <div>
              <ProviderTextField control={control} className="mb-4" label="Host" name="host" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="Website" name="website" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="Status Page" name="status-page" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="Country" name="country" providerAttributesSchema={providerAttributesSchema} valueModifier={function (value) { return value === null || value === void 0 ? void 0 : value.toUpperCase(); }}/>

              <ProviderSelect control={control} className="mb-4" label="Timezone" name="timezone" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="Hosting Provider" name="hosting-provider" providerAttributesSchema={providerAttributesSchema}/>
            </div>
            {/** RIGHT COLUMN */}
            <div>
              <ProviderTextField control={control} className="mb-4" label="Email" name="email" type="email" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="Organization" name="organization" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderSelect control={control} className="mb-4" label="Location Region" name="location-region" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderTextField control={control} className="mb-4" label="City" name="city" providerAttributesSchema={providerAttributesSchema} valueModifier={function (value) { return value === null || value === void 0 ? void 0 : value.toUpperCase(); }}/>

              <ProviderSelect control={control} className="mb-4" label="Location type" name="location-type" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderSelect control={control} className="mb-4" label="Tier" name="tier" providerAttributesSchema={providerAttributesSchema}/>
            </div>
          </div>
        </FormPaper_1.FormPaper>

        <FormPaper_1.FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">Hardware specifications</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/** LEFT COLUMN */}
            <div>
              <ProviderSelect control={control} className="mb-4" label="GPU" name="hardware-gpu" providerAttributesSchema={providerAttributesSchema}/>
              <ProviderSelect control={control} className="mb-4" label="CPU" name="hardware-cpu" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderSelect control={control} className="mb-4" label="Memory (RAM)" name="hardware-memory" providerAttributesSchema={providerAttributesSchema}/>

              <ProviderCheckbox control={control} providerAttributesSchema={providerAttributesSchema} className="mb-4" label="Persistent storage" name="feat-persistent-storage"/>

              <ProviderTextField control={control} className="mb-4" label="Network Speed Download" name="network-speed-down" providerAttributesSchema={providerAttributesSchema} type="number"/>

              <ProviderTextField control={control} className="mb-4" label="Network Provider" name="network-provider" providerAttributesSchema={providerAttributesSchema}/>
            </div>

            {/** RIGHT COLUMN */}
            <div>
              <exports.ProviderMultiSelect control={control} className="mb-4" label="GPU models" name="hardware-gpu-model" providerAttributesSchema={providerAttributesSchema} optionName="hardware-gpu-model"/>

              <ProviderSelect control={control} className="mb-4" label="CPU architecture" name="hardware-cpu-arch" providerAttributesSchema={providerAttributesSchema}/>

              <exports.ProviderMultiSelect control={control} className="mb-4" label="Disk Storage" name="hardware-disk" providerAttributesSchema={providerAttributesSchema} optionName="hardware-disk"/>

              <exports.ProviderMultiSelect control={control} className="mb-4" label="Persistent Disk Storage" name="feat-persistent-storage-type" providerAttributesSchema={providerAttributesSchema} optionName="feat-persistent-storage-type"/>

              <ProviderTextField control={control} className="mb-4" label="Network Speed Upload" name="network-speed-up" providerAttributesSchema={providerAttributesSchema} type="number"/>
            </div>
          </div>
        </FormPaper_1.FormPaper>

        <FormPaper_1.FormPaper className="mb-4">
          <p className="mb-8 text-lg text-primary">Features</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/** LEFT COLUMN */}
            <div>
              <ProviderCheckbox control={control} providerAttributesSchema={providerAttributesSchema} className="mb-4" label="IP Leasing" name="feat-endpoint-ip"/>

              <ProviderCheckbox control={control} providerAttributesSchema={providerAttributesSchema} className="mb-4" label="Chia support" name="workload-support-chia"/>
            </div>

            {/** RIGHT COLUMN */}
            <div>
              <ProviderCheckbox control={control} providerAttributesSchema={providerAttributesSchema} className="mb-4" label="Custom Domain" name="feat-endpoint-custom-domain"/>

              <exports.ProviderMultiSelect control={control} className="mb-4" label="Chia capabilities" name="workload-support-chia-capabilities" providerAttributesSchema={providerAttributesSchema} optionName="workload-support-chia-capabilities"/>
            </div>
          </div>
        </FormPaper_1.FormPaper>

        <FormPaper_1.FormPaper className="mb-4">
          <div className="mb-8 flex items-center">
            <p className="text-lg text-primary">Unknown attributes</p>

            <components_1.Button size="sm" color="secondary" className="ml-4" onClick={function () { return appendUnkownAttribute({ id: (0, nanoid_1.nanoid)(), key: "", value: "" }); }}>
              Add attribute
            </components_1.Button>
          </div>

          <div>
            {unknownAttributes.length > 0 ? (unknownAttributes.map(function (att, attIndex) {
            var _a;
            return (<div key={att.id} className={(0, utils_1.cn)((_a = {}, _a["mb-4"] = attIndex + 1 !== (_unknownAttributes === null || _unknownAttributes === void 0 ? void 0 : _unknownAttributes.length), _a))}>
                    <div className="flex">
                      <div className="flex flex-grow items-center">
                        <div className="basis-1/2">
                          <components_1.FormField control={control} name={"unknown-attributes.".concat(attIndex, ".key")} render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} type="text" label="Key" className="w-full"/>;
            }}/>
                        </div>

                        <div className="ml-2 basis-1/2">
                          <components_1.FormField control={control} name={"unknown-attributes.".concat(attIndex, ".value")} render={function (_a) {
                var field = _a.field;
                return <components_1.FormInput {...field} type="text" label="Value" className="w-full"/>;
            }}/>
                        </div>
                      </div>

                      <div className="pl-2">
                        <components_1.Button onClick={function () { return removeUnkownAttribute(attIndex); }} size="icon">
                          <iconoir_react_1.Bin />
                        </components_1.Button>
                      </div>
                    </div>
                  </div>);
        })) : (<p className="text-sm text-muted-foreground">None</p>)}
          </div>
        </FormPaper_1.FormPaper>

        {error && <components_1.Alert variant="destructive">{error}</components_1.Alert>}
        {formState.errors && (<components_1.Alert variant="destructive">
            {Object.entries(formState.errors).map(function (_a) {
                var key = _a[0], value = _a[1];
                return <div key={key}>{value.message}</div>;
            })}
          </components_1.Alert>)}

        <div className="flex justify-end pt-4">
          <components_1.Button color="secondary" size="lg" variant="default" type="submit">
            Save
          </components_1.Button>
        </div>
      </form>
    </components_1.Form>);
};
exports.EditProviderForm = EditProviderForm;
var ProviderTextField = function (_a) {
    var control = _a.control, providerAttributesSchema = _a.providerAttributesSchema, name = _a.name, className = _a.className, label = _a.label, _b = _a.type, type = _b === void 0 ? "text" : _b, _c = _a.valueModifier, valueModifier = _c === void 0 ? function (value) { return value; } : _c;
    return (<components_1.FormField control={control} name={name} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type={type} label={label} value={field.value} className={className} onChange={function (event) { return field.onChange(valueModifier(event.target.value || "")); }} endIcon={<components_1.CustomTooltip title={<div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>}>
              <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
            </components_1.CustomTooltip>}/>);
        }}/>);
};
var ProviderCheckbox = function (_a) {
    var control = _a.control, name = _a.name, className = _a.className, label = _a.label, providerAttributesSchema = _a.providerAttributesSchema;
    return (<components_1.FormField control={control} name={name} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem>
          <div className={(0, utils_1.cn)(className, "flex h-[42px] items-center")}>
            <components_1.CheckboxWithLabel label={label} checked={field.value} onCheckedChange={function (value) { return field.onChange(value); }}/>
            <div className="mx-2 flex items-center">
              <components_1.CustomTooltip title={<div>
                    <div>{providerAttributesSchema[name].description}</div>

                    <div>Attribute key: {providerAttributesSchema[name].key}</div>
                  </div>}>
                <iconoir_react_1.InfoCircle className="text-xs text-muted-foreground"/>
              </components_1.CustomTooltip>
            </div>
          </div>
          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
var ProviderSelect = function (_a) {
    var control = _a.control, providerAttributesSchema = _a.providerAttributesSchema, name = _a.name, className = _a.className, label = _a.label, placeholder = _a.placeholder;
    var options = (providerAttributesSchema[name].values || []);
    return (<components_1.FormField control={control} name={name} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem className={(0, utils_1.cn)("w-full", className)}>
          <components_1.FormLabel className="flex items-center">
            {label}

            <components_1.CustomTooltip title={<div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>}>
              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
            </components_1.CustomTooltip>
          </components_1.FormLabel>
          <components_1.Select value={field.value || ""} onValueChange={field.onChange}>
            <components_1.SelectTrigger>
              <components_1.SelectValue placeholder={placeholder}/>
            </components_1.SelectTrigger>
            <components_1.SelectContent>
              <components_1.SelectGroup>
                {options.map(function (option) {
                    return (<components_1.SelectItem key={option.key} value={option.key}>
                      <div className="flex w-full items-center justify-between">
                        <div>{option.description}</div>
                        {option.value}
                      </div>
                    </components_1.SelectItem>);
                })}
              </components_1.SelectGroup>
            </components_1.SelectContent>
          </components_1.Select>
          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
var ProviderMultiSelect = function (_a) {
    var _b;
    var control = _a.control, providerAttributesSchema = _a.providerAttributesSchema, optionName = _a.optionName, name = _a.name, className = _a.className, label = _a.label, placeholder = _a.placeholder, disabled = _a.disabled, _c = _a.valueType, valueType = _c === void 0 ? "description" : _c;
    var options = ((_b = providerAttributesSchema[optionName || ""]) === null || _b === void 0 ? void 0 : _b.values) || [];
    return (<components_1.FormField control={control} name={name} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem className={className}>
          <components_1.FormLabel className="flex items-center">
            {label}

            <components_1.CustomTooltip title={<div>
                  <div>{providerAttributesSchema[name].description}</div>

                  <div>Attribute key: {providerAttributesSchema[name].key}</div>
                </div>}>
              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
            </components_1.CustomTooltip>
          </components_1.FormLabel>
          <components_1.MultipleSelector value={field.value.map(function (v) { return ({
                    value: v.key,
                    label: (valueType === "key" ? v === null || v === void 0 ? void 0 : v.key : v === null || v === void 0 ? void 0 : v.description) || ""
                }); }) || []} options={options.map(function (v) { return ({ value: v.key, label: (valueType === "key" ? v === null || v === void 0 ? void 0 : v.key : v === null || v === void 0 ? void 0 : v.description) || "" }); }) || []} hidePlaceholderWhenSelected placeholder={placeholder} emptyIndicator={<p className="text-center text-lg leading-10 text-gray-600 dark:text-gray-400">no results found.</p>} disabled={disabled} className="mt-2" onChange={function (newValue) {
                    field.onChange(newValue.map(function (v) { return ({ key: v.value, description: v.label }); }));
                }}/>
          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
exports.ProviderMultiSelect = ProviderMultiSelect;
