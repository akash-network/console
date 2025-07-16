"use client";
import React, { useState } from "react";
import { Alert, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Snackbar } from "@akashnetwork/ui/components";
import { Check, Mail, Refresh } from "iconoir-react";
import { useSnackbar } from "notistack";

import { Title } from "@src/components/shared/Title";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { services } from "@src/services/http/http-browser.service";

interface EmailVerificationStepProps {
  onComplete: () => void;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({ onComplete }) => {
  const { user, checkSession } = useCustomUser();
  const { enqueueSnackbar } = useSnackbar();
  const [isResending, setIsResending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  const isEmailVerified = user?.emailVerified;

  const handleResendEmail = async () => {
    if (!user?.id) return;

    setIsResending(true);
    try {
      await services.auth.sendVerificationEmail(user.id);
      enqueueSnackbar(<Snackbar title="Verification email sent" subTitle="Please check your email and click the verification link" iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Failed to send verification email" subTitle="Please try again later or contact support" iconVariant="error" />, {
        variant: "error"
      });
    } finally {
      setIsResending(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsChecking(true);
    try {
      await checkSession();
      enqueueSnackbar(<Snackbar title="Verification status updated" subTitle="Your email verification status has been refreshed" iconVariant="success" />, {
        variant: "success"
      });
    } catch (error) {
      enqueueSnackbar(<Snackbar title="Failed to check verification" subTitle="Please try again or refresh the page" iconVariant="error" />, {
        variant: "error"
      });
    } finally {
      setIsChecking(false);
    }
  };

  const handleContinue = () => {
    if (isEmailVerified) {
      onComplete();
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 text-center">
      <Title>Verify Your Email</Title>

      {isEmailVerified ? (
        <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="success">
          <div className="rounded-full bg-card p-3">
            <Check className="h-6 w-6" />
          </div>
          <div>
            <h4 className="font-medium">Email Verified</h4>
            <p className="text-sm">Your email has been successfully verified.</p>
          </div>
        </Alert>
      ) : (
        <Alert className="mx-auto flex max-w-md flex-row items-center gap-2 text-left" variant="warning">
          <div className="rounded-full bg-card p-3">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <h4 className="font-medium">Email Verification Required</h4>
            <p className="text-sm">Please verify your email address to continue.</p>
          </div>
        </Alert>
      )}

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            {isEmailVerified ? "Your email has been verified successfully." : "We've sent a verification link to your email address."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isEmailVerified ? (
            <>
              <p className="text-sm text-muted-foreground">Didn't receive the email? Check your spam folder or request a new verification email.</p>
              <div className="flex gap-2">
                <Button onClick={handleResendEmail} variant="outline" disabled={isResending} className="flex-1">
                  <Refresh className="mr-2 h-4 w-4" />
                  {isResending ? "Sending..." : "Resend Email"}
                </Button>
                <Button onClick={handleCheckVerification} disabled={isChecking} className="flex-1">
                  {isChecking ? "Checking..." : "Check Verification"}
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={handleContinue} className="w-full">
              Continue
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
