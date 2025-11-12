"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
var UserFavorites_1 = require("@src/components/user/UserFavorites");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
var withCustomPageAuthRequired_1 = require("@src/utils/withCustomPageAuthRequired");
var UserFavoritesPage = function () {
    return <UserFavorites_1.UserFavorites />;
};
exports.default = UserFavoritesPage;
exports.getServerSideProps = (0, withCustomPageAuthRequired_1.withCustomPageAuthRequired)({
    getServerSideProps: (0, defineServerSideProps_1.defineServerSideProps)({
        route: "/user/settings/favorites"
    })
});
