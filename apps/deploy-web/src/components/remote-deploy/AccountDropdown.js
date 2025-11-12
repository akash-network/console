"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var jotai_1 = require("jotai");
var lucide_react_1 = require("lucide-react");
var remoteDeployStore_1 = require("@src/store/remoteDeployStore");
var AccountDropDown = function (_a) {
    var _b, _c;
    var userProfile = _a.userProfile, userProfileBit = _a.userProfileBit, userProfileGitLab = _a.userProfileGitLab;
    var _d = (0, jotai_1.useAtom)(remoteDeployStore_1.tokens), token = _d[0], setToken = _d[1];
    return (<components_1.DropdownMenu>
      <components_1.DropdownMenuTrigger>
        <components_1.Button variant={"outline"} className="flex h-auto items-center gap-5 bg-popover py-1">
          <div className="flex items-center gap-2">
            <components_1.Avatar className="size-8">
              <components_1.AvatarImage src={(userProfile === null || userProfile === void 0 ? void 0 : userProfile.avatar_url) || ((_c = (_b = userProfileBit === null || userProfileBit === void 0 ? void 0 : userProfileBit.links) === null || _b === void 0 ? void 0 : _b.avatar) === null || _c === void 0 ? void 0 : _c.href) || (userProfileGitLab === null || userProfileGitLab === void 0 ? void 0 : userProfileGitLab.avatar_url)}/>
              <components_1.AvatarFallback>
                <iconoir_react_1.User />
              </components_1.AvatarFallback>
            </components_1.Avatar>
            <p className="hidden md:block">{(userProfile === null || userProfile === void 0 ? void 0 : userProfile.login) || (userProfileBit === null || userProfileBit === void 0 ? void 0 : userProfileBit.username) || (userProfileGitLab === null || userProfileGitLab === void 0 ? void 0 : userProfileGitLab.name)}</p>
          </div>
          <lucide_react_1.ChevronDown size={16}/>
        </components_1.Button>
      </components_1.DropdownMenuTrigger>
      <components_1.DropdownMenuContent>
        <components_1.DropdownMenuLabel className="md:hidden">{(userProfile === null || userProfile === void 0 ? void 0 : userProfile.login) || (userProfileBit === null || userProfileBit === void 0 ? void 0 : userProfileBit.username) || (userProfileGitLab === null || userProfileGitLab === void 0 ? void 0 : userProfileGitLab.name)}</components_1.DropdownMenuLabel>
        <components_1.DropdownMenuSeparator className="md:hidden"/>
        <components_1.DropdownMenuItem onClick={function () {
            var _a, _b;
            setToken({
                accessToken: null,
                refreshToken: null,
                type: "github",
                alreadyLoggedIn: ((_a = token === null || token === void 0 ? void 0 : token.alreadyLoggedIn) === null || _a === void 0 ? void 0 : _a.includes(token.type))
                    ? token.alreadyLoggedIn
                    : (token === null || token === void 0 ? void 0 : token.alreadyLoggedIn) && ((_b = token === null || token === void 0 ? void 0 : token.alreadyLoggedIn) === null || _b === void 0 ? void 0 : _b.length) > 0
                        ? __spreadArray(__spreadArray([], token.alreadyLoggedIn, true), [token.type], false) : [token.type]
            });
        }} className="flex cursor-pointer items-center gap-2">
          <iconoir_react_1.CoinsSwap className="text-sm"/> Switch Git Provider
        </components_1.DropdownMenuItem>
        <components_1.DropdownMenuItem onClick={function () {
            return setToken({
                accessToken: null,
                refreshToken: null,
                type: "github",
                alreadyLoggedIn: []
            });
        }} className="flex cursor-pointer items-center gap-2">
          <iconoir_react_1.LogOut className="text-sm"/> Logout
        </components_1.DropdownMenuItem>
      </components_1.DropdownMenuContent>
    </components_1.DropdownMenu>);
};
exports.default = AccountDropDown;
