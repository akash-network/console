"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rewriteLocalRedirect = rewriteLocalRedirect;
function rewriteLocalRedirect(res, config) {
    var redirect = res.redirect;
    res.redirect = function rewriteLocalRedirect(urlOrStatus, maybeUrl) {
        var code = typeof urlOrStatus === "string" ? 302 : urlOrStatus;
        var inputUrl = typeof urlOrStatus === "string" ? urlOrStatus : maybeUrl;
        var rewritten = config.AUTH0_REDIRECT_BASE_URL ? inputUrl.replace(config.AUTH0_ISSUER_BASE_URL, config.AUTH0_REDIRECT_BASE_URL || "") : inputUrl;
        return redirect.apply(this, [code, rewritten]);
    };
}
