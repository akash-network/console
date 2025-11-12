"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannelEditContainer = void 0;
var react_1 = require("react");
var react_2 = require("react");
var ServicesProvider_1 = require("@src/context/ServicesProvider");
var useNotificator_1 = require("@src/hooks/useNotificator");
var useWhen_1 = require("@src/hooks/useWhen");
var NotificationChannelEditContainer = function (_a) {
    var id = _a.id, children = _a.children, onEditSuccess = _a.onEditSuccess;
    var notificationsApi = (0, ServicesProvider_1.useServices)().notificationsApi;
    var mutation = notificationsApi.v1.patchNotificationChannel.useMutation({
        path: {
            id: id
        }
    });
    var notificator = (0, useNotificator_1.useNotificator)();
    var edit = (0, react_2.useCallback)(function (_a) {
        var emails = _a.emails, name = _a.name;
        mutation.mutate({
            data: {
                name: name,
                config: {
                    addresses: emails
                }
            }
        });
    }, [mutation]);
    (0, useWhen_1.useWhen)(mutation.isSuccess, function () {
        notificator.success("Notification channel saved!", { dataTestId: "notification-channel-edit-success-notification" });
        onEditSuccess();
    }, [mutation.isSuccess, notificator, onEditSuccess]);
    (0, useWhen_1.useWhen)(mutation.isError, function () { return notificator.error("Failed to save notification channel...", { dataTestId: "notification-channel-edit-error-notification" }); });
    return (<>
      {children({
            onEdit: edit,
            isLoading: mutation.isPending
        })}
    </>);
};
exports.NotificationChannelEditContainer = NotificationChannelEditContainer;
