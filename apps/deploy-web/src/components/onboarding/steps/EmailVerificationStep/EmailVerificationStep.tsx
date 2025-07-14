"use client";
import React from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { Mail } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface EmailVerificationStepProps {
  onComplete: () => void;
}

export const EmailVerificationStep: React.FunctionComponent<EmailVerificationStepProps> = ({ onComplete }) => {
  return (
    <div className="space-y-6 text-center">
      <Title>Verify Your Email</Title>
      <p className="text-muted-foreground">Please check your email and click the verification link to continue.</p>

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-primary/10 p-3">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>We&apos;ve sent a verification link to your email address.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Didn&apos;t receive the email? Check your spam folder or request a new verification email.</p>
          <Button onClick={onComplete} className="w-full">
            I&apos;ve Verified My Email
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
