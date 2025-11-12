"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentNameModal = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var zod_1 = require("@hookform/resolvers/zod");
var notistack_1 = require("notistack");
var zod_2 = require("zod");
var ServicesProvider_1 = require("../ServicesProvider");
var WalletProvider_1 = require("../WalletProvider");
var formSchema = zod_2.z.object({
    name: zod_2.z.string()
});
var DeploymentNameModal = function (_a) {
    var dseq = _a.dseq, onClose = _a.onClose, onSaved = _a.onSaved, getDeploymentName = _a.getDeploymentName;
    var deploymentLocalStorage = (0, ServicesProvider_1.useServices)().deploymentLocalStorage;
    var address = (0, WalletProvider_1.useWallet)().address;
    var formRef = (0, react_1.useRef)(null);
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    var form = (0, react_hook_form_1.useForm)({
        defaultValues: {
            name: ""
        },
        resolver: (0, zod_1.zodResolver)(formSchema)
    });
    var handleSubmit = form.handleSubmit, control = form.control, setValue = form.setValue;
    (0, react_1.useEffect)(function () {
        if (dseq) {
            var name_1 = getDeploymentName(dseq);
            setValue("name", name_1 || "");
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dseq, getDeploymentName]);
    var onSaveClick = function (event) {
        var _a;
        event.preventDefault();
        (_a = formRef.current) === null || _a === void 0 ? void 0 : _a.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
    };
    function onSubmit(_a) {
        var name = _a.name;
        deploymentLocalStorage.update(address, dseq, { name: name });
        enqueueSnackbar(<components_1.Snackbar title="Success!" iconVariant="success"/>, { variant: "success", autoHideDuration: 1000 });
        onSaved();
    }
    return (<components_1.Popup fullWidth open={!!dseq} variant="custom" title={"Change Deployment Name ".concat(dseq ? "(".concat(dseq, ")") : "")} actions={[
            {
                label: "Close",
                color: "secondary",
                variant: "ghost",
                side: "left",
                onClick: onClose
            },
            {
                label: "Save",
                color: "primary",
                variant: "default",
                side: "right",
                onClick: onSaveClick
            }
        ]} onClose={onClose} maxWidth="xs">
      <components_1.Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} ref={formRef}>
          <components_1.FormField control={control} name="name" render={function (_a) {
            var field = _a.field;
            return <components_1.FormInput {...field} label="Name" autoFocus type="text"/>;
        }}/>
        </form>
      </components_1.Form>
    </components_1.Popup>);
};
exports.DeploymentNameModal = DeploymentNameModal;
