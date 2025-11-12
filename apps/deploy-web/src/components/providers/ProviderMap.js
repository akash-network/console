"use strict";
"use client";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderMap = void 0;
var react_1 = require("react");
var react_simple_maps_1 = require("react-simple-maps");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var minZoom = 1;
var maxZoom = 8;
var ProviderMap = function (_a) {
    var providers = _a.providers, _b = _a.initialZoom, initialZoom = _b === void 0 ? minZoom : _b, _c = _a.initialCoordinates, initialCoordinates = _c === void 0 ? [0, 0] : _c;
    var _d = (0, react_1.useState)({ r: 5, w: 1 }), dotSize = _d[0], setDotSize = _d[1];
    var activeProviders = providers.filter(function (x) { return x.isOnline; });
    var _e = (0, react_1.useState)({ coordinates: initialCoordinates, zoom: initialZoom }), position = _e[0], setPosition = _e[1];
    var isInitialPosition = position.coordinates[0] === initialCoordinates[0] && position.coordinates[1] === initialCoordinates[1] && position.zoom === initialZoom;
    (0, react_1.useEffect)(function () {
        handleDotSize(position.zoom);
    }, []);
    function resetZoom() {
        setPosition({ coordinates: initialCoordinates, zoom: initialZoom });
        handleDotSize(initialZoom);
    }
    function handleMoveEnd(position) {
        setPosition(position);
        handleDotSize(position.zoom);
    }
    var handleDotSize = function (zoom) {
        if (zoom < 3) {
            setDotSize({ r: 5, w: 1 });
        }
        else if (zoom < 5) {
            setDotSize({ r: 3, w: 0.8 });
        }
        else if (zoom < 6.5) {
            setDotSize({ r: 2, w: 0.5 });
        }
        else if (zoom <= maxZoom) {
            setDotSize({ r: 1.5, w: 0.2 });
        }
    };
    var handleZoomIn = function () {
        setPosition(function (prev) {
            var newZoom = Math.min(maxZoom, prev.zoom + 1);
            handleDotSize(newZoom);
            return __assign(__assign({}, prev), { zoom: newZoom });
        });
    };
    var handleZoomOut = function () {
        setPosition(function (prev) {
            var newZoom = Math.max(minZoom, prev.zoom - 1);
            handleDotSize(newZoom);
            return __assign(__assign({}, prev), { zoom: newZoom });
        });
    };
    return (<div className="relative flex">
      <div className="absolute left-1/2 -translate-x-1/2 transform space-x-2 rounded-md bg-black bg-opacity-20 p-2">
        <components_1.Button onClick={handleZoomIn} disabled={position.zoom === maxZoom} size="icon" variant="ghost">
          <iconoir_react_1.Plus />
        </components_1.Button>
        <components_1.Button onClick={handleZoomOut} disabled={position.zoom === minZoom} size="icon" variant="ghost">
          <iconoir_react_1.Minus />
        </components_1.Button>

        <components_1.Button onClick={function () { return resetZoom(); }} disabled={isInitialPosition} size="icon" variant="ghost">
          <iconoir_react_1.Restart />
        </components_1.Button>
      </div>
      <react_simple_maps_1.ComposableMap projectionConfig={{ rotate: [-10, 0, 0] }}>
        <react_simple_maps_1.ZoomableGroup zoom={position.zoom} center={position.coordinates} onMoveEnd={handleMoveEnd} filterZoomEvent={function (e) {
            if (e instanceof WheelEvent) {
                return false;
            }
            return true;
        }}>
          <react_simple_maps_1.Geographies geography="https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json">
            {function (_a) {
            var geographies = _a.geographies;
            return geographies.map(function (geo) { return (<react_simple_maps_1.Geography key={geo.rsmKey} geography={geo} className="fill-neutral-500 dark:fill-neutral-800" style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" }
                }}/>); });
        }}
          </react_simple_maps_1.Geographies>
          {activeProviders.map(function (_a) {
            var owner = _a.owner, name = _a.name, ipLon = _a.ipLon, ipLat = _a.ipLat, ipRegion = _a.ipRegion, ipCountryCode = _a.ipCountryCode;
            return (<link_1.default key={owner} href={urlUtils_1.UrlService.providerDetail(owner)}>
                <react_simple_maps_1.Marker coordinates={[parseFloat(ipLon), parseFloat(ipLat)]}>
                  <components_1.CustomNoDivTooltip title={<div>
                        <div className="text-lg">{name}</div>
                        <strong>
                          {ipRegion}, {ipCountryCode}
                        </strong>
                      </div>}>
                    <circle className="cursor-pointer fill-primary" stroke="#FFF" strokeWidth={dotSize.w} r={dotSize.r}/>
                  </components_1.CustomNoDivTooltip>
                </react_simple_maps_1.Marker>
              </link_1.default>);
        })}
        </react_simple_maps_1.ZoomableGroup>
      </react_simple_maps_1.ComposableMap>
    </div>);
};
exports.ProviderMap = ProviderMap;
