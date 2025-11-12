"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandFormModal = void 0;
var components_1 = require("@akashnetwork/ui/components");
var FormPaper_1 = require("./FormPaper");
var CommandFormModal = function (_a) {
    var control = _a.control, serviceIndex = _a.serviceIndex, onClose = _a.onClose;
    return (<components_1.Popup fullWidth open variant="custom" title="Edit Commands" actions={[
            {
                label: "Close",
                color: "primary",
                variant: "ghost",
                side: "right",
                onClick: onClose
            }
        ]} onClose={onClose} maxWidth="sm" enableCloseOnBackdropClick>
      <FormPaper_1.FormPaper className="!bg-popover">
        <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".command.command")} render={function (_a) {
            var field = _a.field;
            return (<components_1.Textarea rows={4} label="Command" value={field.value} placeholder="Example: bash -c" onChange={function (event) { return field.onChange(event.target.value); }}/>);
        }}/>

        <components_1.FormField control={control} name={"services.".concat(serviceIndex, ".command.arg")} render={function (_a) {
            var field = _a.field;
            return (<components_1.Textarea aria-label="Args" placeholder="Example: apt-get update; apt-get install -y --no-install-recommends -- ssh;" label="Arguments" inputClassName="mt-2 w-full px-4 py-2 text-sm" value={field.value} rows={4} spellCheck={false} onChange={field.onChange}/>);
        }}/>
      </FormPaper_1.FormPaper>
    </components_1.Popup>);
};
exports.CommandFormModal = CommandFormModal;
