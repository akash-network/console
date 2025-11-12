"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationChannelSelect = exports.NotificationChannelSelectView = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var NotificationChannelsListContainer_1 = require("@src/components/alerts/NotificationChannelsListContainer/NotificationChannelsListContainer");
var LoadingBlocker_1 = require("@src/components/layout/LoadingBlocker/LoadingBlocker");
var NotificationChannelSelectView = function (_a) {
    var name = _a.name, isFetched = _a.isFetched, data = _a.data, disabled = _a.disabled;
    var _b = (0, react_hook_form_1.useFormContext)(), control = _b.control, getFieldState = _b.getFieldState;
    var state = getFieldState(name);
    return (<LoadingBlocker_1.LoadingBlocker isLoading={!isFetched}>
      <components_1.FormLabel htmlFor="notification-channel-id" className={(0, utils_1.cn)({ "cursor-not-allowed text-red-500": state.error })}>
        Notification Channel
      </components_1.FormLabel>
      <div className="flex">
        <components_1.FormField control={control} name={name} render={function (_a) {
            var field = _a.field, fieldState = _a.fieldState;
            return (<>
              <div className="flex-1">
                <components_1.Select value={field.value || ""} onValueChange={field.onChange} disabled={disabled}>
                  <components_1.SelectTrigger id="notification-channel-id" className={(0, utils_1.cn)({ "border-2 border-red-500": fieldState.error })}>
                    <components_1.SelectValue placeholder="Select notification channel"/>
                  </components_1.SelectTrigger>
                  <components_1.SelectContent>
                    <components_1.SelectGroup>
                      {data.map(function (notificationChannel) { return (<components_1.SelectItem key={notificationChannel.id} value={notificationChannel.id}>
                          {notificationChannel.name}
                        </components_1.SelectItem>); })}
                    </components_1.SelectGroup>
                  </components_1.SelectContent>
                </components_1.Select>
                {fieldState.error && <p className="text-xs font-medium text-destructive">{fieldState.error.message}</p>}
              </div>
            </>);
        }}/>
        <div className="ml-2">
          <link_1.default href="/alerts/notification-channels/new" aria-label="Add notification channel" className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "default" }), "inline-flex items-center", {
            "opacity-10": disabled,
            "cursor-not-allowed": disabled
        })} onClick={function (e) {
            if (disabled) {
                e.preventDefault();
            }
        }}>
            <iconoir_react_1.Plus />
          </link_1.default>
        </div>
      </div>
    </LoadingBlocker_1.LoadingBlocker>);
};
exports.NotificationChannelSelectView = NotificationChannelSelectView;
var NotificationChannelSelect = function (props) { return (<NotificationChannelsListContainer_1.NotificationChannelsListContainer>
    {function (_a) {
    var data = _a.data, isFetched = _a.isFetched;
    return <exports.NotificationChannelSelectView data={data} isFetched={isFetched} {...props}/>;
}}
  </NotificationChannelsListContainer_1.NotificationChannelsListContainer>); };
exports.NotificationChannelSelect = NotificationChannelSelect;
