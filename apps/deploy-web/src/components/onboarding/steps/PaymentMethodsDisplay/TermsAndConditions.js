"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TermsAndConditions = void 0;
var react_1 = require("react");
var link_1 = require("next/link");
var urlUtils_1 = require("@src/utils/urlUtils");
var TermsAndConditions = function () { return (<div className="mx-auto max-w-md text-center">
    <p className="text-xs text-muted-foreground">
      By starting your trial, you agree to our{" "}
      <link_1.default href={urlUtils_1.UrlService.termsOfService()} className="text-primary hover:underline">
        Terms of Service
      </link_1.default>{" "}
      and{" "}
      <link_1.default href={urlUtils_1.UrlService.privacyPolicy()} className="text-primary hover:underline">
        Privacy Policy
      </link_1.default>
    </p>
  </div>); };
exports.TermsAndConditions = TermsAndConditions;
