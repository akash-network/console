"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BidCountdownTimer = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var date_fns_1 = require("date-fns");
var iconoir_react_1 = require("iconoir-react");
var useBlocksQuery_1 = require("@src/queries/useBlocksQuery");
// 5 minutes
var time = 5 * 60;
var BidCountdownTimer = function (_a) {
    var _b;
    var height = _a.height;
    var _c = (0, react_1.useState)(time), timeLeft = _c[0], setTimeLeft = _c[1]; // Set the initial time in seconds
    var _d = (0, react_1.useState)(false), isTimerInit = _d[0], setIsTimerInit = _d[1];
    var _e = (0, useBlocksQuery_1.useBlock)(height || ""), block = _e.data, getBlock = _e.refetch;
    (0, react_1.useEffect)(function () {
        getBlock();
    }, []);
    (0, react_1.useEffect)(function () {
        var date = block ? new Date(block.block.header.time) : new Date(0);
        var now = new Date();
        // add 20 seconds for the delay between deployment creation and bid creation
        var diff = Math.max(0, time - (0, date_fns_1.differenceInSeconds)(now, date) + 20);
        setTimeLeft(diff);
        setIsTimerInit(!!block);
    }, [block]);
    (0, react_1.useEffect)(function () {
        // Exit early when we reach 0
        if (!timeLeft)
            return;
        // Save intervalId to clear the interval when the component unmounts
        var intervalId = setInterval(function () {
            setTimeLeft(timeLeft - 1);
        }, 1000);
        // Clear interval on unmount
        return function () { return clearInterval(intervalId); };
    }, [timeLeft, block]);
    // Calculate the minutes and seconds
    var minutes = Math.floor(timeLeft / 60);
    var seconds = timeLeft % 60;
    // Format the minutes and seconds to display as 2 digits
    var formattedMinutes = minutes < 10 ? "0" + minutes : minutes;
    var formattedSeconds = seconds < 10 ? "0" + seconds : seconds;
    if (!isTimerInit)
        return null;
    return (<components_1.Badge variant={timeLeft === 0 ? "destructive" : "outline"}>
      <span className="inline-flex items-center">
        {timeLeft === 0 ? (<>Time's up!</>) : (<>
            Time Remaining: {formattedMinutes}:{formattedSeconds}
          </>)}

        <components_1.CustomTooltip title={<div>Bids automatically close 5 minutes after the deployment is created if none are selected for a lease.</div>}>
          <iconoir_react_1.InfoCircle className={(0, utils_1.cn)("ml-2 text-xs", (_b = {}, _b["text-muted-foreground"] = timeLeft !== 0, _b["text-white"] = timeLeft === 0, _b))}/>
        </components_1.CustomTooltip>
      </span>
    </components_1.Badge>);
};
exports.BidCountdownTimer = BidCountdownTimer;
