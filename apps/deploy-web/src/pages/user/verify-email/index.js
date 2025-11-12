"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = VerifyEmailPage;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var CheckCircle_1 = require("@mui/icons-material/CheckCircle");
var ErrorOutline_1 = require("@mui/icons-material/ErrorOutline");
var iconoir_react_1 = require("iconoir-react");
var navigation_1 = require("next/navigation");
var next_seo_1 = require("next-seo");
var Layout_1 = require("@src/components/layout/Layout");
var useWhen_1 = require("@src/hooks/useWhen");
var useVerifyEmailQuery_1 = require("@src/queries/useVerifyEmailQuery");
var urlUtils_1 = require("@src/utils/urlUtils");
function VerificationResult(_a) {
    var isVerified = _a.isVerified;
    var gotoOnboarding = (0, react_1.useCallback)(function () {
        window.location.href = urlUtils_1.UrlService.onboarding();
    }, []);
    return (<div className="mt-10 text-center">
      {isVerified ? (<>
          <CheckCircle_1.default className="mb-2 h-16 w-16 text-green-500"/>
          <h5>
            Your email was verified.
            <br />
            You can continue using the application.
          </h5>
          <components_1.AutoButton onClick={gotoOnboarding} text={<>
                Continue <iconoir_react_1.ArrowRight className="ml-4"/>
              </>} timeout={5000}/>
        </>) : (<>
          <ErrorOutline_1.default className="mb-2 h-16 w-16 text-red-500"/>
          <h5>Your email was not verified. Please try again.</h5>
        </>)}
    </div>);
}
function VerifyEmailPage() {
    var email = (0, navigation_1.useSearchParams)().get("email");
    var _a = (0, react_1.useState)(null), isVerified = _a[0], setIsVerified = _a[1];
    var _b = (0, useVerifyEmailQuery_1.useVerifyEmail)({ onSuccess: setIsVerified, onError: function () { return setIsVerified(false); } }), verifyEmail = _b.mutate, isVerifying = _b.isPending;
    (0, useWhen_1.useWhen)(email, function () {
        if (email) {
            verifyEmail(email);
        }
    });
    return (<Layout_1.default>
      <next_seo_1.NextSeo title="Verifying your email"/>
      {isVerifying ? (<Layout_1.Loading text="Just a moment while we finish verifying your email."/>) : (<>
          <VerificationResult isVerified={isVerified === true}/>
        </>)}
    </Layout_1.default>);
}
