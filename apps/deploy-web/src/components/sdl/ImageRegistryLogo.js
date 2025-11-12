"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageRegistryLogo = void 0;
var image_1 = require("next/legacy/image");
var images = {
    "docker.io": {
        filename: "docker",
        height: 18
    },
    "ghcr.io": {
        filename: "github",
        height: 24
    }
};
var ImageRegistryLogo = function (_a) {
    var _b = _a.host, host = _b === void 0 ? "docker.io" : _b;
    return <image_1.default alt="Docker Logo" src={"/images/".concat(images[host].filename, ".png")} layout="fixed" quality={100} width={24} height={images[host].height} priority/>;
};
exports.ImageRegistryLogo = ImageRegistryLogo;
