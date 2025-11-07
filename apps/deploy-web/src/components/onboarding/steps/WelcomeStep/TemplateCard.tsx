"use client";
import React from "react";
import { Button, Card, Spinner } from "@akashnetwork/ui/components";

export interface TemplateCardProps {
  icon: React.ReactNode;
  title: string;
  description: React.ReactNode;
  onDeploy: () => void;
  disabled?: boolean;
  isLoading?: boolean;
}

export const TemplateCard: React.FC<TemplateCardProps> = ({ icon, title, description, onDeploy, disabled, isLoading }) => (
  <Card className="flex flex-col bg-card">
    <div className="flex flex-1 flex-col p-5">
      <div className="mb-4 flex justify-center rounded-md border p-2">{icon}</div>
      <div className="mb-4 flex-1 space-y-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <Button onClick={onDeploy} disabled={disabled} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
        {isLoading ? <Spinner size="small" /> : "Deploy Now"}
      </Button>
    </div>
  </Card>
);
