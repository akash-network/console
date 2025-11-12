"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLocalStorage = void 0;
var semver_1 = require("semver");
var APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "0.0.0";
var migrations = {
    "0.14.0": function () { }
};
// Store latestUpdatedVersion in localStorage
// Check if latestUpdatedVersion is < currentVersion
// If so run all the version > until current is reached.
var migrateLocalStorage = function () {
    var currentVersion = APP_VERSION;
    var version = getVersion();
    var hasPreviousVersion = version && (0, semver_1.neq)(currentVersion, version);
    if (hasPreviousVersion) {
        Object.keys(migrations).forEach(function (migrationVersion) {
            if ((0, semver_1.gt)(migrationVersion, version)) {
                try {
                    console.log("Applying version ".concat(migrationVersion));
                    // Execute local storage migration
                    migrations[migrationVersion]();
                }
                catch (error) {
                    console.log(error);
                }
            }
        });
    }
    localStorage.setItem("latestUpdatedVersion", currentVersion);
};
exports.migrateLocalStorage = migrateLocalStorage;
function getVersion() {
    var latestUpdatedVersion = localStorage.getItem("latestUpdatedVersion");
    if (latestUpdatedVersion) {
        return latestUpdatedVersion;
    }
    var isOldVersionUpgrade = Object.keys(localStorage).some(function (key) { return key.endsWith(".data") || key.endsWith(".wallet"); });
    if (isOldVersionUpgrade) {
        return "1.0.0";
    }
    return APP_VERSION;
}
