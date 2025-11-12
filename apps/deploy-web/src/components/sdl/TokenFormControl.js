"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenFormControl = void 0;
var components_1 = require("@akashnetwork/ui/components");
var useDenom_1 = require("@src/hooks/useDenom");
var TokenFormControl = function (_a) {
    var control = _a.control, name = _a.name, defaultValue = _a.defaultValue;
    var supportedSdlDenoms = (0, useDenom_1.useSdlDenoms)();
    return (<components_1.FormField control={control} name={name} defaultValue={defaultValue} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem>
            <components_1.FormLabel>Token</components_1.FormLabel>
            <components_1.Select value={field.value || ""} onValueChange={field.onChange}>
              <components_1.SelectTrigger>
                <components_1.SelectValue placeholder="Select token"/>
              </components_1.SelectTrigger>
              <components_1.SelectContent>
                <components_1.SelectGroup>
                  {supportedSdlDenoms.map(function (t) {
                    return (<components_1.SelectItem key={t.id} value={t.value}>
                        {t.tokenLabel}
                      </components_1.SelectItem>);
                })}
                </components_1.SelectGroup>
              </components_1.SelectContent>
            </components_1.Select>
            <components_1.FormMessage />
          </components_1.FormItem>);
        }}/>);
};
exports.TokenFormControl = TokenFormControl;
