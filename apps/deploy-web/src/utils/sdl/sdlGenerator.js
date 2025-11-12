"use strict";
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
exports.generateSdl = exports.buildCommand = void 0;
var js_yaml_1 = require("js-yaml");
var data_1 = require("./data");
var buildCommand = function (command) {
    if (command.trim() === "sh -c") {
        return ["sh", "-c"];
    }
    var lines = command.split("\n");
    if (lines.length > 1 || command.startsWith("sh -c")) {
        var commandWithoutEmptyLines = lines
            .map(function (line) { return line.trim(); })
            .filter(Boolean)
            .join("\n") + "\n";
        return ["sh", "-c", commandWithoutEmptyLines.replace(/^sh -c\s*/, "")];
    }
    return command;
};
exports.buildCommand = buildCommand;
var generateSdl = function (services, region) {
    var sdl = { version: "2.0", services: {}, profiles: { compute: {}, placement: {} }, deployment: {} };
    services.forEach(function (service) {
        var _a;
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        sdl.services[service.title] = {
            image: service.image,
            credentials: service.hasCredentials ? service.credentials : undefined,
            // Expose
            expose: service.expose.map(function (e) {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
                // Port
                var _expose = { port: e.port };
                // As
                if (e.as) {
                    _expose["as"] = e.as;
                }
                // Accept
                var accept = (_a = e.accept) === null || _a === void 0 ? void 0 : _a.map(function (a) { return a.value; });
                if (((accept === null || accept === void 0 ? void 0 : accept.length) || 0) > 0) {
                    _expose["accept"] = accept;
                }
                // Proto
                var proto = getProto(e);
                if (proto) {
                    _expose["proto"] = proto;
                }
                // To
                var to = (_b = e.to) === null || _b === void 0 ? void 0 : _b.map(function (to) {
                    var _a;
                    return (_a = {}, _a["service"] = to.value, _a);
                });
                _expose["to"] = [
                    __assign({ global: !!e.global }, (e.ipName ? { ip: e.ipName } : {}))
                ].concat(to);
                // HTTP Options
                if (e.hasCustomHttpOptions) {
                    _expose["http_options"] = {
                        max_body_size: (_d = (_c = e.httpOptions) === null || _c === void 0 ? void 0 : _c.maxBodySize) !== null && _d !== void 0 ? _d : data_1.defaultHttpOptions.maxBodySize,
                        read_timeout: (_f = (_e = e.httpOptions) === null || _e === void 0 ? void 0 : _e.readTimeout) !== null && _f !== void 0 ? _f : data_1.defaultHttpOptions.readTimeout,
                        send_timeout: (_h = (_g = e.httpOptions) === null || _g === void 0 ? void 0 : _g.sendTimeout) !== null && _h !== void 0 ? _h : data_1.defaultHttpOptions.sendTimeout,
                        next_cases: (_k = (_j = e.httpOptions) === null || _j === void 0 ? void 0 : _j.nextCases) !== null && _k !== void 0 ? _k : data_1.defaultHttpOptions.nextCases,
                        next_tries: (_m = (_l = e.httpOptions) === null || _l === void 0 ? void 0 : _l.nextTries) !== null && _m !== void 0 ? _m : data_1.defaultHttpOptions.nextTries,
                        next_timeout: (_p = (_o = e.httpOptions) === null || _o === void 0 ? void 0 : _o.nextTimeout) !== null && _p !== void 0 ? _p : data_1.defaultHttpOptions.nextTimeout
                    };
                }
                return _expose;
            })
        };
        // Command
        var trimmedCommand = (_c = (_b = service.command) === null || _b === void 0 ? void 0 : _b.command) === null || _c === void 0 ? void 0 : _c.trim();
        if (trimmedCommand) {
            sdl.services[service.title].command = (0, exports.buildCommand)(trimmedCommand);
            sdl.services[service.title].args = [(_e = (_d = service.command) === null || _d === void 0 ? void 0 : _d.arg) === null || _e === void 0 ? void 0 : _e.trim()];
        }
        // Env
        if ((((_f = service.env) === null || _f === void 0 ? void 0 : _f.length) || 0) > 0) {
            sdl.services[service.title].env = (_g = service.env) === null || _g === void 0 ? void 0 : _g.map(function (e) { var _a; return "".concat(e.key.trim(), "=").concat(e.isSecret ? "" : (_a = e.value) === null || _a === void 0 ? void 0 : _a.trim()); });
        }
        // Compute
        sdl.profiles.compute[service.title] = {
            resources: {
                cpu: {
                    units: service.profile.cpu
                },
                memory: {
                    size: "".concat(service.profile.ram).concat(service.profile.ramUnit)
                },
                storage: [
                    {
                        size: "".concat(service.profile.storage[0].size).concat(service.profile.storage[0].unit)
                    }
                ]
            }
        };
        // GPU
        if (service.profile.hasGpu) {
            sdl.profiles.compute[service.title].resources.gpu = {
                units: service.profile.gpu,
                attributes: {
                    vendor: {}
                }
            };
            // Group models by vendor
            var vendors = ((_h = service.profile.gpuModels) === null || _h === void 0 ? void 0 : _h.reduce(function (group, model) {
                var _a;
                var vendor = model.vendor;
                group[vendor] = (_a = group[vendor]) !== null && _a !== void 0 ? _a : [];
                group[vendor].push(model);
                return group;
            }, {})) || {};
            for (var _i = 0, _w = Object.entries(vendors); _i < _w.length; _i++) {
                var _x = _w[_i], vendor = _x[0], models = _x[1];
                var mappedModels = models
                    .map(function (x) {
                    var model = null;
                    if (x.name) {
                        model = {
                            model: x.name
                        };
                    }
                    if (model && x.memory) {
                        model.ram = x.memory;
                    }
                    if (model && x.interface) {
                        model.interface = x.interface;
                    }
                    return model;
                })
                    .filter(function (x) { return x; });
                sdl.profiles.compute[service.title].resources.gpu.attributes.vendor[vendor] = mappedModels.length > 0 ? mappedModels : null;
            }
        }
        // Persistent Storage
        if (service.profile.storage.length > 1) {
            sdl.services[service.title].params = {
                storage: {}
            };
            service.profile.storage.slice(1).forEach(function (storage) {
                if (storage.name) {
                    sdl.services[service.title].params.storage[storage.name] = {
                        mount: storage.mount,
                        readOnly: !!storage.isReadOnly
                    };
                }
                sdl.profiles.compute[service.title].resources.storage.push({
                    name: storage.name,
                    size: "".concat(storage.size).concat(storage.unit),
                    attributes: {
                        persistent: storage.isPersistent,
                        class: storage.type
                    }
                });
            });
        }
        // Placement
        sdl.profiles.placement[service.placement.name] = sdl.profiles.placement[service.placement.name] || { pricing: {} };
        sdl.profiles.placement[service.placement.name].pricing[service.title] = {
            denom: service.placement.pricing.denom,
            amount: service.placement.pricing.amount
        };
        // Signed by
        if ((((_k = (_j = service.placement.signedBy) === null || _j === void 0 ? void 0 : _j.anyOf) === null || _k === void 0 ? void 0 : _k.length) || 0) > 0 || (((_m = (_l = service.placement.signedBy) === null || _l === void 0 ? void 0 : _l.anyOf) === null || _m === void 0 ? void 0 : _m.length) || 0) > 0) {
            if ((((_p = (_o = service.placement.signedBy) === null || _o === void 0 ? void 0 : _o.anyOf) === null || _p === void 0 ? void 0 : _p.length) || 0) > 0) {
                sdl.profiles.placement[service.placement.name].signedBy = {
                    anyOf: (_q = service.placement.signedBy) === null || _q === void 0 ? void 0 : _q.anyOf.map(function (x) { return x.value; })
                };
            }
            if ((((_s = (_r = service.placement.signedBy) === null || _r === void 0 ? void 0 : _r.allOf) === null || _s === void 0 ? void 0 : _s.length) || 0) > 0) {
                sdl.profiles.placement[service.placement.name].signedBy.allOf = (_t = service.placement.signedBy) === null || _t === void 0 ? void 0 : _t.allOf.map(function (x) { return x.value; });
            }
        }
        // Attributes
        if ((((_u = service.placement.attributes) === null || _u === void 0 ? void 0 : _u.length) || 0) > 0) {
            sdl.profiles.placement[service.placement.name].attributes = (_v = service.placement.attributes) === null || _v === void 0 ? void 0 : _v.reduce(function (acc, curr) { return ((acc[curr.key] = curr.value), acc); }, {});
        }
        // Regions
        if (!!region && region !== "any") {
            sdl.profiles.placement[service.placement.name].attributes = __assign(__assign({}, (sdl.profiles.placement[service.placement.name].attributes || {})), { "location-region": region.toLowerCase() });
        }
        // IP Lease
        if (service.expose.some(function (exp) { return exp.ipName; })) {
            sdl["endpoints"] = {};
            service.expose
                .filter(function (exp) { return !!exp.ipName; })
                .forEach(function (exp) {
                sdl["endpoints"][exp.ipName] = {
                    kind: "ip"
                };
            });
        }
        // Count
        sdl.deployment[service.title] = (_a = {},
            _a[service.placement.name] = {
                profile: service.title,
                count: service.count
            },
            _a);
    });
    var result = js_yaml_1.default.dump(sdl, {
        indent: 2,
        quotingType: '"',
        styles: {
            "!!null": "empty" // dump null as empty value
        }
    });
    return "---\n".concat(result);
};
exports.generateSdl = generateSdl;
var getProto = function (expose) {
    if (expose.proto && expose.proto === "http") {
        return null;
    }
    else {
        return expose.proto;
    }
};
