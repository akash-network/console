"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContainer = createContainer;
exports.createChildContainer = createChildContainer;
function createContainer(factories) {
    var accessor = {};
    var resolvePath = [];
    Object.keys(factories).forEach(function (key) {
        var instance = null;
        Object.defineProperty(accessor, key, {
            configurable: true,
            enumerable: true,
            get: function () {
                if (!instance) {
                    if (resolvePath.includes(key)) {
                        throw new Error("Circular dependency detected: ".concat(resolvePath.concat(key).join(" -> ")));
                    }
                    resolvePath.push(key);
                    try {
                        instance = factories[key]();
                    }
                    finally {
                        resolvePath.pop();
                    }
                }
                return instance;
            }
        });
    });
    return accessor;
}
function createChildContainer(parent, factories) {
    var child = createContainer(factories);
    Object.setPrototypeOf(child, parent);
    return child;
}
