"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrendIndicator = void 0;
var react_1 = require("react");
var date_fns_1 = require("date-fns");
var iconoir_react_1 = require("iconoir-react");
var COMPONENTS = {
    GraphUp: iconoir_react_1.GraphUp,
    GraphDown: iconoir_react_1.GraphDown
};
var TrendIndicator = function (_a) {
    var isFetching = _a.isFetching, data = _a.data, field = _a.field, _b = _a.components, _c = _b === void 0 ? COMPONENTS : _b, GraphUp = _c.GraphUp, GraphDown = _c.GraphDown;
    var trendData = react_1.default.useMemo(function () {
        if (data.length < 2)
            return null;
        var sortedData = data.filter(function (item) { return typeof item[field] === "number"; });
        if (sortedData.length < 2)
            return null;
        var firstItem = sortedData[0];
        var lastItem = sortedData[sortedData.length - 1];
        var firstValue = firstItem[field];
        var lastValue = lastItem[field];
        if (typeof firstValue !== "number" || typeof lastValue !== "number")
            return null;
        if (firstValue === 0)
            return null;
        var percentageChange = ((lastValue - firstValue) / firstValue) * 100;
        var isCurrentDay = (0, date_fns_1.isToday)(new Date(lastItem.date));
        return {
            change: Math.round(percentageChange * 100) / 100,
            period: isCurrentDay ? "today" : null
        };
    }, [data, field]);
    if (isFetching || !trendData || trendData.change === 0)
        return null;
    var isUp = trendData.change > 0;
    return (<p className="mt-2 text-gray-500">
      Trending {isUp ? "up" : "down"} by {Math.abs(trendData.change)}% {trendData.period && <span className="font-medium">{trendData.period}</span>}{" "}
      {isUp ? <GraphUp className="inline h-4 w-4"/> : <GraphDown className="inline h-4 w-4"/>}
    </p>);
};
exports.TrendIndicator = TrendIndicator;
