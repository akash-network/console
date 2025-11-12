"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
var RequiredUserContainer_1 = require("@src/components/user/RequiredUserContainer");
var UserSettingsForm_1 = require("@src/components/user/UserSettingsForm");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
var withCustomPageAuthRequired_1 = require("@src/utils/withCustomPageAuthRequired");
var UserSettingsPage = function () {
    return <RequiredUserContainer_1.RequiredUserContainer>{function (user) { return <UserSettingsForm_1.UserSettingsForm user={user}/>; }}</RequiredUserContainer_1.RequiredUserContainer>;
};
exports.default = UserSettingsPage;
exports.getServerSideProps = (0, withCustomPageAuthRequired_1.withCustomPageAuthRequired)({
    getServerSideProps: (0, defineServerSideProps_1.defineServerSideProps)({
        route: "/user/settings"
    })
});
