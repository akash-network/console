"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useNotificator = useNotificator;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var notistack_1 = require("notistack");
function useNotificator() {
    var enqueueSnackbar = (0, notistack_1.useSnackbar)().enqueueSnackbar;
    return (0, react_1.useMemo)(function () { return ({
        success: function (message, options) {
            enqueueSnackbar(<components_1.Snackbar data-testid={options === null || options === void 0 ? void 0 : options.dataTestId} title="Success" subTitle={message}/>, { variant: "success", autoHideDuration: 3000 });
        },
        error: function (message, options) {
            enqueueSnackbar(<components_1.Snackbar data-testid={options === null || options === void 0 ? void 0 : options.dataTestId} title="Error" subTitle={message}/>, { variant: "error", autoHideDuration: 3000 });
        }
    }); }, [enqueueSnackbar]);
}
