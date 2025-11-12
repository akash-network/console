"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomNextSeo = void 0;
var react_1 = require("react");
var next_seo_1 = require("next-seo");
var CustomNextSeo = function (_a) {
    var title = _a.title, _b = _a.description, description = _b === void 0 ? "" : _b, url = _a.url, images = _a.images;
    return (<next_seo_1.NextSeo title={title} description={description} canonical={url} openGraph={{
            url: url,
            title: title,
            description: description,
            images: images
        }}/>);
};
exports.CustomNextSeo = CustomNextSeo;
