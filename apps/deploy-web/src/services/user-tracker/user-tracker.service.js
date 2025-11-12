"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserTracker = void 0;
var nextjs_1 = require("@sentry/nextjs");
var UserTracker = /** @class */ (function () {
    function UserTracker() {
    }
    UserTracker.prototype.track = function (user) {
        if (user) {
            (0, nextjs_1.setUser)({
                id: user.id
            });
        }
        else {
            (0, nextjs_1.setUser)(null);
        }
        (0, nextjs_1.setTags)({
            anonymous: user ? !user.userId : undefined,
            emailVerified: user === null || user === void 0 ? void 0 : user.emailVerified
        });
    };
    return UserTracker;
}());
exports.UserTracker = UserTracker;
