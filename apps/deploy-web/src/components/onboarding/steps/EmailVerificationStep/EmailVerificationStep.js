"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailVerificationStep = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var Title_1 = require("@src/components/shared/Title");
var EmailVerificationStep = function (_a) {
    var isEmailVerified = _a.isEmailVerified, isResending = _a.isResending, isChecking = _a.isChecking, onResendEmail = _a.onResendEmail, onCheckVerification = _a.onCheckVerification, onContinue = _a.onContinue;
    return (<div className="mx-auto max-w-md space-y-6 text-center">
      <Title_1.Title>Verify Your Email</Title_1.Title>

      {isEmailVerified ? (<components_1.Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="success">
          <div className="rounded-full bg-card p-3">
            <iconoir_react_1.Check className="h-6 w-6"/>
          </div>
          <div>
            <h4 className="font-medium">Email Verified</h4>
            <p className="text-sm">Your email has been successfully verified.</p>
          </div>
        </components_1.Alert>) : (<components_1.Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="warning">
          <div className="rounded-full bg-card p-3">
            <iconoir_react_1.Mail className="h-4 w-4"/>
          </div>
          <div>
            <h4 className="font-medium">Email Verification Required</h4>
            <p className="text-sm">Please verify your email address to continue.</p>
          </div>
        </components_1.Alert>)}

      <components_1.Card className="mx-auto max-w-md">
        <components_1.CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <iconoir_react_1.Mail className="h-8 w-8 text-primary"/>
            </div>
          </div>
          <components_1.CardTitle>Email Verification</components_1.CardTitle>
          <components_1.CardDescription>
            {isEmailVerified ? "Your email has been verified successfully." : "We've sent a verification link to your email address."}
          </components_1.CardDescription>
        </components_1.CardHeader>
        <components_1.CardContent className="space-y-4">
          {!isEmailVerified ? (<>
              <p className="text-sm text-muted-foreground">Didn't receive the email? Check your spam folder or request a new verification email.</p>
              <div className="flex gap-2">
                <components_1.Button onClick={onResendEmail} variant="outline" disabled={isResending} className="flex-1">
                  <iconoir_react_1.Refresh className="mr-2 h-4 w-4"/>
                  {isResending ? "Sending..." : "Resend Email"}
                </components_1.Button>
                <components_1.Button onClick={onCheckVerification} disabled={isChecking} className="flex-1">
                  {isChecking ? "Checking..." : "Check Verification"}
                </components_1.Button>
              </div>
            </>) : (<components_1.Button onClick={onContinue} className="w-full">
              Continue
            </components_1.Button>)}
        </components_1.CardContent>
      </components_1.Card>
    </div>);
};
exports.EmailVerificationStep = EmailVerificationStep;
