"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importSimpleSdl = exports.parseSvcCommand = void 0;
var js_yaml_1 = require("js-yaml");
var nanoid_1 = require("nanoid");
var deploymentData_1 = require("../deploymentData");
var stringUtils_1 = require("../stringUtils");
var data_1 = require("./data");
var parseSvcCommand = function (command) {
    if (!command) {
        return "";
    }
    if (typeof command === "string") {
        return (0, exports.parseSvcCommand)([command]);
    }
    if (command[0] === "sh" && command[1] === "-c") {
        return command.slice(2).filter(Boolean).join("\n");
    }
    return command.filter(Boolean).join("\n");
};
exports.parseSvcCommand = parseSvcCommand;
var importSimpleSdl = function (yamlStr) {
    try {
        var yamlJson_1 = js_yaml_1.default.load(yamlStr);
        var services_1 = [];
        if (!yamlJson_1.services)
            return services_1;
        Object.keys(yamlJson_1.services).forEach(function (svcName) {
            var _a, _b, _c, _d;
            var svc = yamlJson_1.services[svcName];
            var service = {
                id: (0, nanoid_1.nanoid)(),
                title: svcName,
                image: svc.image,
                hasCredentials: !!svc.credentials,
                credentials: svc.credentials
            };
            var compute = yamlJson_1.profiles.compute[svcName];
            var storages = compute.resources.storage.map ? compute.resources.storage : [compute.resources.storage];
            // TODO validation
            // Service compute profile
            service.profile = {
                cpu: compute.resources.cpu.units,
                gpu: compute.resources.gpu ? compute.resources.gpu.units : 0,
                gpuModels: compute.resources.gpu ? getGpuModels(compute.resources.gpu.attributes.vendor) : [],
                hasGpu: !!compute.resources.gpu,
                ram: getResourceDigit(compute.resources.memory.size),
                ramUnit: getResourceUnit(compute.resources.memory.size),
                storage: storages.map(function (storage) {
                    var _a, _b, _c, _d, _e, _f;
                    var type = ((_a = storage.attributes) === null || _a === void 0 ? void 0 : _a.class) || "beta3";
                    var isPersistent = ((_b = storage.attributes) === null || _b === void 0 ? void 0 : _b.persistent) || false;
                    var isReadOnly = ((_d = (_c = svc.params) === null || _c === void 0 ? void 0 : _c.storage[storage.name]) === null || _d === void 0 ? void 0 : _d.readOnly) || false;
                    if (type === "ram") {
                        if (isPersistent) {
                            throw new deploymentData_1.CustomValidationError("A storage of class \"ram\" cannot be persistent.");
                        }
                        if (isReadOnly) {
                            throw new deploymentData_1.CustomValidationError("A storage of class \"ram\" cannot be read-only.");
                        }
                    }
                    return {
                        size: getResourceDigit(storage.size || "1Gi"),
                        unit: getResourceUnit(storage.size || "1Gi"),
                        isPersistent: isPersistent,
                        type: type,
                        name: storage.name,
                        mount: ((_f = (_e = svc.params) === null || _e === void 0 ? void 0 : _e.storage[storage.name]) === null || _f === void 0 ? void 0 : _f.mount) || "",
                        isReadOnly: isReadOnly
                    };
                })
            };
            // Command
            service.command = {
                command: (0, exports.parseSvcCommand)(svc.command),
                arg: svc.args ? svc.args[0] : ""
            };
            // Env
            service.env = ((_a = svc.env) === null || _a === void 0 ? void 0 : _a.map(function (e) { return ({ id: (0, nanoid_1.nanoid)(), key: e.split("=")[0], value: e.split("=")[1] }); })) || [];
            // Expose
            service.expose = [];
            (_b = svc.expose) === null || _b === void 0 ? void 0 : _b.forEach(function (expose) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                var isGlobal = expose.to.find(function (t) { return t.global; });
                var _expose = {
                    id: (0, nanoid_1.nanoid)(),
                    port: expose.port,
                    as: expose.as || 80,
                    proto: expose.proto === "tcp" ? expose.proto : "http",
                    global: !!isGlobal,
                    to: expose.to.filter(function (t) { return t.global === undefined; }).map(function (t) { return ({ id: (0, nanoid_1.nanoid)(), value: t.service }); }),
                    accept: ((_a = expose.accept) === null || _a === void 0 ? void 0 : _a.map(function (a) { return ({ id: (0, nanoid_1.nanoid)(), value: a }); })) || [],
                    ipName: (isGlobal === null || isGlobal === void 0 ? void 0 : isGlobal.ip) ? isGlobal.ip : "",
                    hasCustomHttpOptions: !!expose.http_options,
                    httpOptions: {
                        maxBodySize: (_c = (_b = expose.http_options) === null || _b === void 0 ? void 0 : _b.max_body_size) !== null && _c !== void 0 ? _c : data_1.defaultHttpOptions.maxBodySize,
                        readTimeout: (_e = (_d = expose.http_options) === null || _d === void 0 ? void 0 : _d.read_timeout) !== null && _e !== void 0 ? _e : data_1.defaultHttpOptions.readTimeout,
                        sendTimeout: (_g = (_f = expose.http_options) === null || _f === void 0 ? void 0 : _f.send_timeout) !== null && _g !== void 0 ? _g : data_1.defaultHttpOptions.sendTimeout,
                        nextCases: (_j = (_h = expose.http_options) === null || _h === void 0 ? void 0 : _h.next_cases) !== null && _j !== void 0 ? _j : data_1.defaultHttpOptions.nextCases,
                        nextTries: (_l = (_k = expose.http_options) === null || _k === void 0 ? void 0 : _k.next_tries) !== null && _l !== void 0 ? _l : data_1.defaultHttpOptions.nextTries,
                        nextTimeout: (_o = (_m = expose.http_options) === null || _m === void 0 ? void 0 : _m.next_timeout) !== null && _o !== void 0 ? _o : data_1.defaultHttpOptions.nextTimeout
                    }
                };
                (_p = service.expose) === null || _p === void 0 ? void 0 : _p.push(_expose);
            });
            // Placement
            var depl = yamlJson_1.deployment[svcName];
            var sortedPlacementNames = Object.keys(depl).sort();
            // Only one placement available
            var placementName = sortedPlacementNames[0];
            var placement = yamlJson_1.profiles.placement[placementName];
            if (!placement) {
                throw new deploymentData_1.CustomValidationError("Unable to find placement: ".concat(placementName));
            }
            var placementPricing = placement.pricing[svcName];
            var deployment = depl[placementName];
            service.placement = {
                name: placementName,
                pricing: {
                    amount: placementPricing.amount,
                    denom: placementPricing.denom
                },
                signedBy: {
                    anyOf: placement.signedBy && ((_c = placement.signedBy) === null || _c === void 0 ? void 0 : _c.anyOf) ? placement.signedBy.anyOf.map(function (x) { return ({ id: (0, nanoid_1.nanoid)(), value: x }); }) : [],
                    allOf: placement.signedBy && ((_d = placement.signedBy) === null || _d === void 0 ? void 0 : _d.allOf) ? placement.signedBy.allOf.map(function (x) { return ({ id: (0, nanoid_1.nanoid)(), value: x }); }) : []
                },
                attributes: placement.attributes
                    ? Object.keys(placement.attributes).map(function (attKey) {
                        var attVal = placement.attributes[attKey];
                        return {
                            id: (0, nanoid_1.nanoid)(),
                            key: attKey,
                            value: attVal
                        };
                    })
                    : []
            };
            service.count = deployment.count;
            services_1.push(service);
        });
        return services_1;
    }
    catch (error) {
        console.log(error);
        throw error;
    }
};
exports.importSimpleSdl = importSimpleSdl;
var getResourceDigit = function (size) {
    var match = size.match(/\d+/g);
    return match ? parseFloat(match[0]) : 0;
};
var getResourceUnit = function (size) {
    var match = size.match(/[a-zA-Z]+/g);
    return match ? (0, stringUtils_1.capitalizeFirstLetter)(match[0]) : "";
};
var getGpuModels = function (vendor) {
    var models = [];
    var _loop_1 = function (vendorName, vendorModels) {
        if (vendorModels) {
            vendorModels.forEach(function (m) {
                models.push({
                    vendor: vendorName,
                    name: m.model,
                    memory: m.ram || "",
                    interface: m.interface || ""
                });
            });
        }
        else {
            models.push({
                vendor: vendorName,
                name: "",
                memory: "",
                interface: ""
            });
        }
    };
    for (var _i = 0, _a = Object.entries(vendor); _i < _a.length; _i++) {
        var _b = _a[_i], vendorName = _b[0], vendorModels = _b[1];
        _loop_1(vendorName, vendorModels);
    }
    return models;
};
