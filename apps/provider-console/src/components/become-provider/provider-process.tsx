"use client";
import { Separator } from "@akashnetwork/ui/components";
import React, { useState, useEffect } from "react";
import { CheckIcon, Loader2Icon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";

interface ProviderProcessProps {
  // Add any props if needed
}

interface ProcessStep {
  name: string;
  status: "completed" | "in-progress" | "pending";
  logs?: string; // Add this line
}

export const ProviderProcess: React.FunctionComponent<ProviderProcessProps> = () => {
  const [progress, setProgress] = useState(24);
  const [openAccordions, setOpenAccordions] = useState<boolean[]>([]); // Add this line

  const [steps, setSteps] = useState<ProcessStep[]>([
    { name: "Logs...", status: "completed", logs: "Sample logs for step 1..." },
    { name: "Checking System for Akash Provider", status: "in-progress", logs: "Sample logs for step 2..." },
    { name: "Installing Provider Helm Chart", status: "pending", logs: "Sample logs for step 3..." },
    { name: "Installing K3S", status: "pending", logs: "Sample logs for step 4..." },
  ]);

  useEffect(() => {
    // Simulate progress update
    const timer = setInterval(() => {
      setProgress((prevProgress) => {
        if (prevProgress >= 100) {
          clearInterval(timer);
          return 100;
        }
        return prevProgress + 1;
      });
    }, 100000);

    return () => clearInterval(timer);
  }, []);

  const toggleAccordion = (index: number) => {
    setOpenAccordions(prev => {
      const newState = [...prev];
      newState[index] = !newState[index];
      return newState;
    });
  };

  return (
    <div className="flex flex-col items-center pt-10 w-full">
      <div className="space-y-6 w-full max-w-2xl">
        <div>
          <h3 className="text-xl font-bold">Setting up Provider</h3>
          <p className="text-muted-foreground text-sm">This process may take few minutes.</p>
        </div>
        <div>
          <Separator />
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Loader2Icon className="h-5 w-5 text-blue-500 animate-spin" />
            <span className="text-lg font-semibold">Becoming a Provider... {progress}%</span>
          </div>
          {/* <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full"
              style={{ width: `${progress}%` }}
            ></div>
          </div> */}
        </div>
        <div className="space-y-4">
          <div className="border rounded-md">
            {steps.map((step, index) => (
              <div key={index}>
                <div 
                  className="flex items-center justify-between p-4 cursor-pointer bg-white"
                  onClick={() => step.logs && toggleAccordion(index)}
                >
                  <div className="flex items-center">
                    {step.logs && (
                      openAccordions[index] ? 
                        <ChevronDownIcon className="h-5 w-5 mr-2" /> : 
                        <ChevronRightIcon className="h-5 w-5 mr-2" />
                    )}
                    <span>{step.name}</span>
                  </div>
                  <div className="flex items-center">
                    {step.status === "completed" && (
                      <div className="bg-gray-200 rounded-full p-1">
                        <CheckIcon className="h-4 w-4 text-green-500" />
                      </div>
                    )}
                    {step.status === "in-progress" && (
                      <Loader2Icon className="h-5 w-5 text-blue-500 animate-spin" />
                    )}
                    {step.status === "pending" && (
                      <div className="h-5 w-5 rounded-full border-2 border-gray-300"></div>
                    )}
                  </div>
                </div>
                {step.logs && openAccordions[index] && (
                  <div className="p-4 bg-gray-100 border-t">
                    <pre className="whitespace-pre-wrap text-sm">
                      <code>{step.logs}</code>
                    </pre>
                  </div>
                )}
                {index < steps.length - 1 && <div className="border-t"></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
