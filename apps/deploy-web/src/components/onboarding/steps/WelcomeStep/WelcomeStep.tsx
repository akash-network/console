"use client";
import React from "react";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@akashnetwork/ui/components";
import { CheckCircle, Rocket } from "iconoir-react";

import { Title } from "@src/components/shared/Title";

interface WelcomeStepProps {
  onComplete: () => void;
}

export const WelcomeStep: React.FunctionComponent<WelcomeStepProps> = ({ onComplete }) => {
  return (
    <div className="space-y-6 text-center">
      <Title>Welcome to Akash Console!</Title>
      <p className="text-muted-foreground">Your account is now set up and ready to go. Start deploying your applications on Akash Network.</p>

      <Card className="mx-auto max-w-md">
        <CardHeader>
          <div className="mb-4 flex justify-center">
            <div className="rounded-full bg-green-100 p-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </div>
          <CardTitle>Setup Complete</CardTitle>
          <CardDescription>You&apos;re all set to start using Akash Console!</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>✓ Account created successfully</p>
            <p>✓ Email verified</p>
            <p>✓ Payment method added</p>
            <p>✓ Free trial activated</p>
          </div>
          <Button onClick={onComplete} className="w-full">
            <Rocket className="mr-2 h-4 w-4" />
            Start Deploying
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
