"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleServiceFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var styles_1 = require("@mui/material/styles");
var useMediaQuery_1 = require("@mui/material/useMediaQuery");
var iconoir_react_1 = require("iconoir-react");
var image_1 = require("next/legacy/image");
var SSHKeyFromControl_1 = require("@src/components/sdl/SSHKeyFromControl");
var denom_config_1 = require("@src/config/denom.config");
var SdlBuilderProvider_1 = require("@src/context/SdlBuilderProvider/SdlBuilderProvider");
var WalletProvider_1 = require("@src/context/WalletProvider");
var useFlag_1 = require("@src/hooks/useFlag");
var mathHelpers_1 = require("@src/utils/mathHelpers");
var priceUtils_1 = require("@src/utils/priceUtils");
var LeaseSpecDetail_1 = require("../shared/LeaseSpecDetail");
var PriceValue_1 = require("../shared/PriceValue");
var EnvFormModal_1 = require("./EnvFormModal/EnvFormModal");
var LogCollectorControl_1 = require("./LogCollectorControl/LogCollectorControl");
var CommandFormModal_1 = require("./CommandFormModal");
var CommandList_1 = require("./CommandList");
var CpuFormControl_1 = require("./CpuFormControl");
var EnvVarList_1 = require("./EnvVarList");
var EphemeralStorageFormControl_1 = require("./EphemeralStorageFormControl");
var ExposeFormModal_1 = require("./ExposeFormModal");
var ExposeList_1 = require("./ExposeList");
var FormPaper_1 = require("./FormPaper");
var GpuFormControl_1 = require("./GpuFormControl");
var ImageCredentialsHost_1 = require("./ImageCredentialsHost");
var ImageCredentialsPassword_1 = require("./ImageCredentialsPassword");
var ImageCredentialsUsername_1 = require("./ImageCredentialsUsername");
var ImageInput_1 = require("./ImageInput");
var MemoryFormControl_1 = require("./MemoryFormControl");
var MountedStorageFormControl_1 = require("./MountedStorageFormControl");
var PlacementFormModal_1 = require("./PlacementFormModal");
var TokenFormControl_1 = require("./TokenFormControl");
var SimpleServiceFormControl = function (_a) {
    var _b, _c;
    var _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    var serviceIndex = _a.serviceIndex, control = _a.control, _services = _a._services, onRemoveService = _a.onRemoveService, trigger = _a.trigger, serviceCollapsed = _a.serviceCollapsed, setServiceCollapsed = _a.setServiceCollapsed, setValue = _a.setValue, gpuModels = _a.gpuModels, hasSecretOption = _a.hasSecretOption, isGitProviderTemplate = _a.isGitProviderTemplate;
    var _r = (0, react_1.useState)(null), isEditingCommands = _r[0], setIsEditingCommands = _r[1];
    var _s = (0, react_1.useState)(null), isEditingEnv = _s[0], setIsEditingEnv = _s[1];
    var _t = (0, react_1.useState)(null), isEditingExpose = _t[0], setIsEditingExpose = _t[1];
    var _u = (0, react_1.useState)(null), isEditingPlacement = _u[0], setIsEditingPlacement = _u[1];
    var muiTheme = (0, styles_1.useTheme)();
    var isDesktop = (0, useMediaQuery_1.default)(muiTheme.breakpoints.up("sm"));
    var expanded = !serviceCollapsed.some(function (x) { return x === serviceIndex; });
    var currentService = _services[serviceIndex];
    var _isEditingEnv = serviceIndex === isEditingEnv;
    var _isEditingCommands = serviceIndex === isEditingCommands;
    var _isEditingExpose = serviceIndex === isEditingExpose;
    var _isEditingPlacement = serviceIndex === isEditingPlacement;
    var _credentials = (_d = _services[serviceIndex]) === null || _d === void 0 ? void 0 : _d.credentials;
    var _isGhcr = (_credentials === null || _credentials === void 0 ? void 0 : _credentials.host) === "ghcr.io";
    var _v = (0, SdlBuilderProvider_1.useSdlBuilder)(), imageList = _v.imageList, hasComponent = _v.hasComponent, toggleCmp = _v.toggleCmp;
    var wallet = (0, WalletProvider_1.useWallet)();
    var isLogCollectorEnabled = (0, useFlag_1.useFlag)("ui_sdl_log_collector_enabled");
    var onExpandClick = function () {
        setServiceCollapsed(function (prev) {
            if (expanded) {
                return prev.concat([serviceIndex]);
            }
            else {
                return prev.filter(function (x) { return x !== serviceIndex; });
            }
        });
    };
    var _w = (0, react_hook_form_1.useFieldArray)({
        control: control,
        name: "services.".concat(serviceIndex, ".profile.storage"),
        keyName: "id"
    }), appendStorage = _w.append, removeStorage = _w.remove, storages = _w.fields;
    if (!currentService || (0, LogCollectorControl_1.isLogCollectorService)(currentService))
        return null;
    return (<components_1.Collapsible open={expanded} onOpenChange={onExpandClick}>
      <components_1.Card className="mt-4 rounded-sm border border-muted-foreground/20">
        <components_1.CardContent className="p-0">
          {/** Edit Environment Variables */}
          {_isEditingEnv && (<EnvFormModal_1.EnvFormModal control={control} onClose={function () { return setIsEditingEnv(null); }} serviceIndex={serviceIndex} envs={currentService.env || []} hasSecretOption={hasSecretOption}/>)}
          {/** Edit Commands */}
          {_isEditingCommands && <CommandFormModal_1.CommandFormModal control={control} onClose={function () { return setIsEditingCommands(null); }} serviceIndex={serviceIndex}/>}
          {/** Edit Expose */}
          {_isEditingExpose && (<ExposeFormModal_1.ExposeFormModal control={control} onClose={function () { return setIsEditingExpose(null); }} serviceIndex={serviceIndex} expose={currentService.expose} services={_services}/>)}
          {/** Edit Placement */}
          {_isEditingPlacement && (<PlacementFormModal_1.PlacementFormModal control={control} onClose={function () { return setIsEditingPlacement(null); }} serviceIndex={serviceIndex} services={_services} placement={currentService.placement}/>)}
          <div className={(0, utils_1.cn)("flex justify-between p-4", (_b = {}, _b["border-b border-muted-foreground/20"] = expanded, _b), isGitProviderTemplate ? "items-center" : "items-end")}>
            {isGitProviderTemplate ? (<h1 className="font-semibold">Build Server Specs</h1>) : (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".title")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="text" label={<div className="inline-flex items-center">
                        Service Name
                        <components_1.CustomTooltip title={<>
                              The service name serves as a identifier for the workload to be ran on the Akash Network.
                              <br />
                              <br />
                              <a href="https://akash.network/docs/getting-started/stack-definition-language/#services" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>}>
                          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                        </components_1.CustomTooltip>
                      </div>} value={field.value} className="flex-grow" onChange={function (event) { return field.onChange((event.target.value || "").toLowerCase()); }}/>);
            }}/>)}
            <div className="ml-4 flex items-center">
              {!expanded && isDesktop && (<div className="flex items-center whitespace-nowrap">
                  <LeaseSpecDetail_1.LeaseSpecDetail type="cpu" className="flex-shrink-0" value={currentService.profile.cpu}/>
                  <LeaseSpecDetail_1.LeaseSpecDetail type="ram" className="ml-4 flex-shrink-0" value={"".concat(currentService.profile.ram, " ").concat(currentService.profile.ramUnit)}/>
                  <LeaseSpecDetail_1.LeaseSpecDetail type="storage" className="ml-4 flex-shrink-0" value={"".concat(currentService.profile.storage[0].size, " ").concat(currentService.profile.storage[0].unit)}/>
                </div>)}
              {_services.length > 1 && (<components_1.Button size="icon" className="ml-2" variant="ghost" onClick={function () { return onRemoveService(serviceIndex); }}>
                  <iconoir_react_1.BinMinusIn />
                </components_1.Button>)}

              <components_1.CollapsibleTrigger asChild>
                <components_1.Button size="icon" variant="ghost" className="ml-2 rounded-full" onClick={onExpandClick}>
                  <iconoir_react_1.NavArrowDown fontSize="1rem" className={(0, utils_1.cn)("transition-all duration-100", (_c = {}, _c["rotate-180"] = expanded, _c))}/>
                </components_1.Button>
              </components_1.CollapsibleTrigger>
            </div>
          </div>
          <components_1.CollapsibleContent>
            <div className="p-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <div className="grid gap-4">
                    {!isGitProviderTemplate &&
            ((imageList === null || imageList === void 0 ? void 0 : imageList.length) ? (<div className="flex items-end">
                          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".image")} render={function (_a) {
                    var field = _a.field, fieldState = _a.fieldState;
                    return (<components_1.FormItem className="w-full">
                                <div className="flex flex-grow flex-col">
                                  <components_1.Select value={field.value} onValueChange={field.onChange}>
                                    <components_1.SelectTrigger className={(0, utils_1.cn)("ml-1", { "ring-2 ring-destructive": !!fieldState.error })} data-testid="ssh-image-select">
                                      <image_1.default alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority/>
                                      <div className="flex-1 pl-2 text-left">
                                        <components_1.SelectValue placeholder="Select image"/>
                                      </div>
                                    </components_1.SelectTrigger>
                                    <components_1.SelectContent>
                                      <components_1.SelectGroup>
                                        {imageList.map(function (image) {
                            return (<components_1.SelectItem key={image} value={image} data-testid={"ssh-image-select-".concat(image)}>
                                              {image}
                                            </components_1.SelectItem>);
                        })}
                                      </components_1.SelectGroup>
                                    </components_1.SelectContent>
                                  </components_1.Select>
                                </div>
                              </components_1.FormItem>);
                }}/>
                        </div>) : (<FormPaper_1.FormPaper className="whitespace-break-spaces break-all">
                          <div className="flex items-end">
                            <ImageInput_1.ImageInput control={control} serviceIndex={serviceIndex} credentials={_credentials} setValue={setValue}/>
                          </div>
                          {((_e = _services[serviceIndex]) === null || _e === void 0 ? void 0 : _e.hasCredentials) && (<>
                              <div>
                                <ImageCredentialsHost_1.ImageCredentialsHost control={control} serviceIndex={serviceIndex}/>
                              </div>
                              <div className="grid gap-2 sm:grid-cols-2">
                                <div>
                                  <ImageCredentialsUsername_1.ImageCredentialsUsername control={control} serviceIndex={serviceIndex}/>
                                </div>
                                <div>
                                  <ImageCredentialsPassword_1.ImageCredentialsPassword control={control} serviceIndex={serviceIndex} label={_isGhcr ? "Personal Access Token" : "Password"}/>
                                </div>
                              </div>
                            </>)}
                        </FormPaper_1.FormPaper>))}

                    <div>
                      <CpuFormControl_1.CpuFormControl control={control} currentService={currentService} serviceIndex={serviceIndex}/>
                    </div>

                    <div>
                      <GpuFormControl_1.GpuFormControl control={control} serviceIndex={serviceIndex} hasGpu={!!currentService.profile.hasGpu} currentService={currentService} gpuModels={gpuModels} setValue={setValue}/>
                    </div>

                    <div>
                      <MemoryFormControl_1.MemoryFormControl control={control} serviceIndex={serviceIndex}/>
                    </div>

                    <div>
                      <EphemeralStorageFormControl_1.EphemeralStorageFormControl services={_services} control={control} serviceIndex={serviceIndex} appendStorage={appendStorage}/>
                    </div>

                    {currentService.profile.storage.length > 1 &&
            (storages || []).slice(1).map(function (storage, storageIndex) { return (<div key={"storage-".concat(storage.id)}>
                          <MountedStorageFormControl_1.MountedStorageFormControl services={_services} control={control} currentService={currentService} serviceIndex={serviceIndex} storageIndex={storageIndex + 1} appendStorage={appendStorage} removeStorage={removeStorage} setValue={setValue}/>
                        </div>); })}
                  </div>
                </div>

                <div>
                  {!isGitProviderTemplate && (<>
                      <div className="grid gap-4">
                        {(hasComponent("ssh") || hasComponent("ssh-toggle")) && (<FormPaper_1.FormPaper className="whitespace-break-spaces break-all">
                            {hasComponent("ssh-toggle") && (<components_1.CheckboxWithLabel checked={hasComponent("ssh")} onCheckedChange={function (checked) {
                        toggleCmp("ssh");
                        setValue("hasSSHKey", !!checked);
                    }} className="ml-4" label="Expose SSH" data-testid="ssh-toggle"/>)}
                            {hasComponent("ssh") && <SSHKeyFromControl_1.SSHKeyFormControl control={control} serviceIndex={serviceIndex} setValue={setValue}/>}
                          </FormPaper_1.FormPaper>)}

                        <div>
                          <EnvVarList_1.EnvVarList currentService={currentService} setIsEditingEnv={setIsEditingEnv} serviceIndex={serviceIndex}/>
                        </div>

                        {hasComponent("command") && (<div>
                            <CommandList_1.CommandList currentService={currentService} setIsEditingCommands={setIsEditingCommands} serviceIndex={serviceIndex}/>
                          </div>)}
                      </div>

                      <div className="mt-4">
                        <ExposeList_1.ExposeList currentService={currentService} setIsEditingExpose={setIsEditingExpose} serviceIndex={serviceIndex}/>
                      </div>
                    </>)}

                  {hasComponent("service-count") && (<div className="mt-4">
                      <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".count")} render={function (_a) {
                var field = _a.field;
                return (<components_1.FormInput type="number" label={<div className="inline-flex items-center">
                                Service Count
                                <components_1.CustomTooltip title={<>
                                      The number of instances of the service to run.
                                      <br />
                                      <br />
                                      <a href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement" target="_blank" rel="noopener">
                                        View official documentation.
                                      </a>
                                    </>}>
                                  <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                                </components_1.CustomTooltip>
                              </div>} value={field.value || ""} onChange={function (event) {
                        var newValue = parseInt(event.target.value);
                        field.onChange(newValue);
                        if (newValue) {
                            trigger("services.".concat(serviceIndex, ".profile.cpu"));
                            trigger("services.".concat(serviceIndex, ".profile.ram"));
                            trigger("services.".concat(serviceIndex, ".profile.storage"));
                        }
                    }} min={1} max={20} step={1}/>);
            }}/>
                    </div>)}

                  {!(wallet === null || wallet === void 0 ? void 0 : wallet.isManaged) && (<div className="mt-4">
                      <TokenFormControl_1.TokenFormControl control={control} name={"services.".concat(serviceIndex, ".placement.pricing.denom")}/>
                    </div>)}

                  {isLogCollectorEnabled && (<div className="mt-4">
                      <FormPaper_1.FormPaper>
                        <LogCollectorControl_1.LogCollectorControl serviceIndex={serviceIndex}/>
                      </FormPaper_1.FormPaper>
                    </div>)}
                </div>
              </div>
              <div className="mt-4 break-all">
                <div className="grid gap-4">
                  <div>
                    <FormPaper_1.FormPaper>
                      <div className="mb-2 flex items-center">
                        <strong className="text-sm">Placement</strong>

                        <components_1.CustomTooltip title={<>
                              Placement is a list of settings to specify where to host the current service workload.
                              <br />
                              <br />
                              You can filter providers by attributes, audited by and pricing.
                              <br />
                              <br />
                              <a href="https://akash.network/docs/getting-started/stack-definition-language/#profilesplacement" target="_blank" rel="noopener">
                                View official documentation.
                              </a>
                            </>}>
                          <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                        </components_1.CustomTooltip>

                        <span className="ml-4 cursor-pointer text-sm text-primary underline" onClick={function () { return setIsEditingPlacement(serviceIndex); }}>
                          Edit
                        </span>
                      </div>

                      <div className="text-xs">
                        <div>
                          <strong>Name</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">{currentService.placement.name}</span>
                        </div>
                        <div>
                          <strong>Pricing</strong>&nbsp;&nbsp;
                          <span className="inline-flex items-center text-muted-foreground">
                            Max {(0, mathHelpers_1.udenomToDenom)(currentService.placement.pricing.amount, 6)} AKT per block
                            <components_1.CustomTooltip title={<>
                                  The maximum amount of uAKT you're willing to pay per block (~6 seconds).
                                  <br />
                                  <br />
                                  Akash will only show providers costing <strong>less</strong> than this amount.
                                  <br />
                                  <br />
                                  <div>
                                    <strong>
                                      ~
                                      <PriceValue_1.PriceValue denom={denom_config_1.UAKT_DENOM} value={(0, mathHelpers_1.udenomToDenom)((0, priceUtils_1.getAvgCostPerMonth)(currentService.placement.pricing.amount))}/>
                                    </strong>
                                    &nbsp; per month
                                  </div>
                                </>}>
                              <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                            </components_1.CustomTooltip>
                          </span>
                        </div>
                        <div>
                          <strong>Attributes</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(((_f = currentService.placement.attributes) === null || _f === void 0 ? void 0 : _f.length) || 0) > 0
            ? (_g = currentService.placement.attributes) === null || _g === void 0 ? void 0 : _g.map(function (a, i) { return (<span key={i} className="text-xs">
                                    {a.key}=<span>{a.value}</span>
                                  </span>); })
            : "None"}
                          </span>
                        </div>
                        <div>
                          <strong>Signed by any of</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(((_j = (_h = currentService.placement.signedBy) === null || _h === void 0 ? void 0 : _h.anyOf) === null || _j === void 0 ? void 0 : _j.length) || 0) > 0
            ? (_l = (_k = currentService.placement.signedBy) === null || _k === void 0 ? void 0 : _k.anyOf) === null || _l === void 0 ? void 0 : _l.map(function (a, i) {
                var _a;
                return (<span key={i} className={(0, utils_1.cn)((_a = {}, _a["ml-2"] = i !== 0, _a))}>
                                    {a.value}
                                  </span>);
            })
            : "None"}
                          </span>
                        </div>
                        <div>
                          <strong>Signed by all of</strong>&nbsp;&nbsp;
                          <span className="text-muted-foreground">
                            {(((_o = (_m = currentService.placement.signedBy) === null || _m === void 0 ? void 0 : _m.allOf) === null || _o === void 0 ? void 0 : _o.length) || 0) > 0
            ? (_q = (_p = currentService.placement.signedBy) === null || _p === void 0 ? void 0 : _p.allOf) === null || _q === void 0 ? void 0 : _q.map(function (a, i) {
                var _a;
                return (<span key={i} className={(0, utils_1.cn)((_a = {}, _a["ml-2"] = i !== 0, _a))}>
                                    {a.value}
                                  </span>);
            })
            : "None"}
                          </span>
                        </div>
                      </div>
                    </FormPaper_1.FormPaper>
                  </div>
                </div>
              </div>
            </div>
          </components_1.CollapsibleContent>
        </components_1.CardContent>
      </components_1.Card>
    </components_1.Collapsible>);
};
exports.SimpleServiceFormControl = SimpleServiceFormControl;
