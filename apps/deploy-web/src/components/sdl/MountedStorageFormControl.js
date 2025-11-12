"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MountedStorageFormControl = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var md_1 = require("react-icons/md");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var units_1 = require("@src/utils/akash/units");
var AddStorageButton_1 = require("./AddStorageButton");
var FormPaper_1 = require("./FormPaper");
var MountedStorageFormControl = function (_a) {
    var services = _a.services, currentService = _a.currentService, serviceIndex = _a.serviceIndex, control = _a.control, storageIndex = _a.storageIndex, appendStorage = _a.appendStorage, removeStorage = _a.removeStorage;
    var isRam = (0, react_1.useMemo)(function () {
        return currentService.profile.storage[storageIndex].type === "ram";
    }, [currentService.profile.storage, storageIndex]);
    return (<FormPaper_1.FormPaper>
      <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".size")} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<components_1.FormItem>
            <div className="flex flex-col items-start lg:flex-row lg:items-center">
              <div className="flex items-center">
                <div className="flex items-center">
                  <md_1.MdStorage className="mr-2 text-2xl text-muted-foreground"/>
                  <strong className="text-sm">{isRam ? "RAM Storage" : "Persistent Storage"}</strong>

                  {!isRam && (<components_1.CustomTooltip title={<>
                          The amount of persistent storage required for this workload.
                          <br />
                          <br />
                          This storage is mounted on a persistent volume and persistent through the lifetime of the deployment
                          <br />
                          <br />
                          <a href="https://akash.network/docs/network-features/persistent-storage/" target="_blank" rel="noopener">
                            View official documentation.
                          </a>
                        </>}>
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>)}
                </div>
              </div>

              <div className="mt-2 flex flex-grow items-center lg:ml-4 lg:mt-0">
                <components_1.Input type="number" color="secondary" value={field.value || ""} error={!!fieldState.error} onChange={function (event) { return field.onChange(parseFloat(event.target.value)); }} min={1} step={1} inputClassName="w-[100px]"/>

                <react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".unit")} defaultValue="" render={function (_a) {
                    var _b;
                    var field = _a.field;
                    return (<components_1.Select value={((_b = field.value) === null || _b === void 0 ? void 0 : _b.toLowerCase()) || ""} onValueChange={field.onChange}>
                      <components_1.SelectTrigger className="ml-1 w-[75px]">
                        <components_1.SelectValue placeholder="Select unit"/>
                      </components_1.SelectTrigger>
                      <components_1.SelectContent>
                        <components_1.SelectGroup>
                          {units_1.storageUnits.map(function (t) {
                            return (<components_1.SelectItem key={t.id} value={t.suffix.toLowerCase()}>
                                {t.suffix}
                              </components_1.SelectItem>);
                        })}
                        </components_1.SelectGroup>
                      </components_1.SelectContent>
                    </components_1.Select>);
                }}/>

                <div className="flex-grow"></div>

                <components_1.Button onClick={function () { return removeStorage(storageIndex); }} size="icon" type="button" variant="ghost">
                  <iconoir_react_1.Bin />
                </components_1.Button>
              </div>
            </div>

            <components_1.Slider value={[field.value || 0]} min={1} max={5120} step={1} onValueChange={function (newValue) { return field.onChange(newValue[0]); }} className="pt-2"/>

            <components_1.FormMessage className={(0, utils_1.cn)({ "pt-2": !!fieldState.error })}/>
          </components_1.FormItem>);
        }}/>

      <div>
        <div className="mt-4 flex items-start">
          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".name")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="text" label={<div className="mb-[6px] flex justify-between">
                    <div className="inline-flex items-center">
                      Name
                      <components_1.CustomTooltip title={<>
                            The name of the volume.
                            <br />
                            <br />
                            Multiple services can gain access to the same volume by name.
                          </>}>
                        <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                      </components_1.CustomTooltip>
                    </div>
                    <div className="inline-flex items-center">
                      {!isRam && (<react_hook_form_1.Controller control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".isReadOnly")} render={function (_a) {
                            var field = _a.field;
                            return (<>
                              <components_1.Checkbox id={"isReadonly-".concat(serviceIndex, "-").concat(storageIndex)} checked={field.value} onCheckedChange={field.onChange} className="ml-2"/>
                              <components_1.Label htmlFor={"isReadonly-".concat(serviceIndex, "-").concat(storageIndex)} className="ml-2 whitespace-nowrap">
                                Read only
                              </components_1.Label>
                            </>);
                        }}/>)}
                    </div>
                  </div>} value={field.value} onChange={function (event) { return field.onChange(event.target.value); }} className="flex-grow"/>);
        }}/>
        </div>
        <div className="mt-4 flex items-start">
          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".type")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem className="w-full basis-[40%]">
                <components_1.FormLabel htmlFor={"persistent-storage-type-".concat(currentService.id)}>Type</components_1.FormLabel>
                <components_1.Select value={field.value || ""} onValueChange={field.onChange} disabled={isRam}>
                  <components_1.SelectTrigger id={"persistent-storage-type-".concat(currentService.id)}>
                    <components_1.SelectValue placeholder="Select type"/>
                  </components_1.SelectTrigger>
                  <components_1.SelectContent>
                    <components_1.SelectGroup>
                      {(currentService.profile.storage[storageIndex].isPersistent ? units_1.persistentStorageTypes : units_1.ephemeralStorageTypes).map(function (t) {
                    return (<components_1.SelectItem key={t.id} value={t.className}>
                            {t.name}
                          </components_1.SelectItem>);
                })}
                    </components_1.SelectGroup>
                  </components_1.SelectContent>
                </components_1.Select>
                <components_1.FormMessage />
              </components_1.FormItem>);
        }}/>

          <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".profile.storage.").concat(storageIndex, ".mount")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormInput type="text" label={<div className="inline-flex items-center">
                    Mount
                    <components_1.CustomTooltip title={<>
                          The path to mount the volume to.
                          <br />
                          <br />
                          Example: /mnt/data
                        </>}>
                      <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
                    </components_1.CustomTooltip>
                  </div>} placeholder="Example: /mnt/data" value={field.value} onChange={function (event) { return field.onChange(event.target.value); }} className="ml-2 w-full"/>);
        }}/>
        </div>
      </div>
      <AddStorageButton_1.AddStorageButton services={services} serviceIndex={serviceIndex} storageIndex={storageIndex} control={control} appendStorage={appendStorage}/>
    </FormPaper_1.FormPaper>);
};
exports.MountedStorageFormControl = MountedStorageFormControl;
