"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountEmailChannelCreator = exports.AccountEmailChannelCreateTrigger = void 0;
var components_1 = require("@akashnetwork/ui/components");
var NotificationChannelCreateContainer_1 = require("@src/components/alerts/NotificationChannelCreateContainer/NotificationChannelCreateContainer");
var useUser_1 = require("@src/hooks/useUser");
var AccountEmailChannelCreateTrigger = function (props) {
    return (<components_1.LoadingButton data-testid={props.testId} loading={props.isLoading} onClick={function () {
            return props.create({
                name: "Primary account email",
                emails: [props.email]
            });
        }}>
      Use my account email
    </components_1.LoadingButton>);
};
exports.AccountEmailChannelCreateTrigger = AccountEmailChannelCreateTrigger;
var AccountEmailChannelCreator = function () {
    var user = (0, useUser_1.useUser)().user;
    return (<NotificationChannelCreateContainer_1.NotificationChannelCreateContainer>
      {function (props) { return ((user === null || user === void 0 ? void 0 : user.email) ? <exports.AccountEmailChannelCreateTrigger {...props} email={user.email}/> : null); }}
    </NotificationChannelCreateContainer_1.NotificationChannelCreateContainer>);
};
exports.AccountEmailChannelCreator = AccountEmailChannelCreator;
