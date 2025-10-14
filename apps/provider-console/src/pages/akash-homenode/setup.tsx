"use client";
import React from "react";
import { Alert, AlertDescription, Button, Card, CardContent, CardHeader, CardTitle, Checkbox, Progress } from "@akashnetwork/ui/components";
import { Activity, Clock, Copy, Dollar, Download, StatsReport } from "iconoir-react";
import Image from "next/image";
import { useRouter } from "next/router";

export default function SetupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = React.useState(1);
  const [isTermsAccepted, setIsTermsAccepted] = React.useState(false);
  const [isDownloaded, setIsDownloaded] = React.useState(false);
  const [isTokenGenerated, setIsTokenGenerated] = React.useState(false);
  const [generatedToken, setGeneratedToken] = React.useState("");
  const [selectedStep, setSelectedStep] = React.useState(1);

  // Mock user data - assume user is logged in
  // const user = {
  //   id: 'mock-user-123',
  //   email: 'test@example.com',
  //   name: 'Test User',
  //   picture: 'https://via.placeholder.com/150'
  // };

  const handleLogout = () => {
    // Simple logout - just redirect to home
    router.push("/");
  };

  const handleDownloadISO = () => {
    console.log("Downloading ISO...");
    // Simulate download completion
    setTimeout(() => {
      setIsDownloaded(true);
      setCurrentStep(2);
      setSelectedStep(2); // Move to next step
    }, 2000);
  };

  const handleGenerateToken = () => {
    console.log("Generating token...");
    // Generate a mock token
    const token = "pickles-relish-olives-anchovies-mustard";
    setGeneratedToken(token);
    setIsTokenGenerated(true);
    setCurrentStep(3);
    setSelectedStep(3); // Move to next step
  };

  const handleMonitorInstallation = () => {
    console.log("Monitoring installation...");
    setCurrentStep(4);
    setSelectedStep(4); // Move to next step
  };

  // Check if a step is accessible
  const isStepAccessible = (step: number) => {
    switch (step) {
      case 1:
        return true; // Always accessible
      case 2:
        return isDownloaded; // Only after download
      case 3:
        return isTokenGenerated; // Only after token generation
      case 4:
        return currentStep >= 4; // Only after monitoring
      default:
        return false;
    }
  };

  return (
    <div className="from-background via-background min-h-screen bg-gradient-to-br to-green-500/5 dark:to-green-500/10">
      {/* Header */}
      <div className="border-b bg-gray-200 dark:bg-gray-800">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center">
              <div className="mr-2 w-auto">
                <Image src="/images/akash-home-node.svg" alt="Akash HomeNode" width={200} height={60} />
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500">
                  <span className="text-xs font-bold text-white">A</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h2 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Welcome to Akash HomeNode!</h2>
          <p className="text-base text-gray-600 dark:text-gray-300">Get set up in minutes using the installation guide provided below.</p>
        </div>

        <div className="grid grid-cols-10 gap-8">
          {/* Left Column - Installation Guide (30%) */}
          <div className="col-span-3">
            <Card className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Installation Guide</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Step 1 - Download ISO */}
                  <div
                    className={`flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-colors ${
                      selectedStep === 1
                        ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                        : "border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => setSelectedStep(1)}
                  >
                    <div
                      className={`flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isDownloaded ? "bg-green-600 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {isDownloaded ? "✓" : "1"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Download ISO file</h4>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                        Run the provided file to automatically setup your home node and start earning.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 - Create Token */}
                  <div
                    className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
                      !isStepAccessible(2)
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50 dark:border-gray-700 dark:bg-gray-800"
                        : selectedStep === 2
                          ? "cursor-pointer border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "cursor-pointer border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => isStepAccessible(2) && setSelectedStep(2)}
                  >
                    <div
                      className={`flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        isTokenGenerated ? "bg-green-600 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {isTokenGenerated ? "✓" : "2"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Create token</h4>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">View installation logs and track progress while we set up your device.</p>
                    </div>
                  </div>

                  {/* Step 3 - Monitor Installation */}
                  <div
                    className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
                      !isStepAccessible(3)
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50 dark:border-gray-700 dark:bg-gray-800"
                        : selectedStep === 3
                          ? "cursor-pointer border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "cursor-pointer border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => isStepAccessible(3) && setSelectedStep(3)}
                  >
                    <div
                      className={`flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        currentStep >= 4 ? "bg-green-600 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {currentStep >= 4 ? "✓" : "3"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Monitor device installation</h4>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">View installation logs and track progress while we set up your device.</p>
                    </div>
                  </div>

                  {/* Step 4 - Start Earning */}
                  <div
                    className={`flex items-start space-x-3 rounded-lg border p-3 transition-colors ${
                      !isStepAccessible(4)
                        ? "cursor-not-allowed border-gray-200 bg-gray-50 opacity-50 dark:border-gray-700 dark:bg-gray-800"
                        : selectedStep === 4
                          ? "cursor-pointer border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "cursor-pointer border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700"
                    }`}
                    onClick={() => isStepAccessible(4) && setSelectedStep(4)}
                  >
                    <div
                      className={`flex h-8 min-h-8 w-8 min-w-8 items-center justify-center rounded-full text-sm font-semibold ${
                        currentStep >= 5 ? "bg-green-600 text-white" : "bg-gray-600 text-white"
                      }`}
                    >
                      {currentStep >= 5 ? "✓" : "4"}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Start earning with Akash</h4>
                      <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Use the Akash HomeNode dashboard to monitor earnings and device health.</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Interactive Steps (70%) */}
          <div className="col-span-7">
            {/* Step 1 - ISO Download Card */}
            {selectedStep === 1 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Start by downloading the provided ISO file</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    Once the download is complete, install the file on your device and our automatic setup will do the rest.
                  </p>
                  <Alert className="mb-4 border-red-200 bg-red-50 text-left dark:border-red-800 dark:bg-red-900/20">
                    <AlertDescription className="text-sm text-red-800 dark:text-red-200">
                      <span className="text-lg text-red-500">⚠️</span> Installing this file on your device will permanently erase all of its contents. This
                      action cannot be undone.
                    </AlertDescription>
                  </Alert>
                  <div className="mb-4 flex items-center justify-center space-x-2">
                    <Checkbox id="terms" checked={isTermsAccepted} onCheckedChange={checked => setIsTermsAccepted(checked as boolean)} />
                    <label htmlFor="terms" className="text-sm text-gray-600 dark:text-gray-300">
                      I understand that installing this file will permanently erase all contents on that device. I accept the T&amp;C&apos;s.
                    </label>
                  </div>
                  <Button onClick={handleDownloadISO} disabled={!isTermsAccepted} className="bg-red-600 py-2 text-sm text-white hover:bg-red-700" size="sm">
                    <Download className="mr-2 h-4 w-4" />
                    Download ISO
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Step 2 - Token Creation Card */}
            {selectedStep === 2 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Create your token</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">When prompted during install, create a token here.</p>
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="flex max-w-2xl items-stretch overflow-hidden rounded-md border border-gray-300 dark:border-gray-600">
                        <div className="flex items-center bg-gray-100 px-3 py-2 text-sm text-gray-500 dark:bg-gray-700 dark:text-gray-400">machine_token</div>
                        <div className="flex flex-1 items-center justify-between border-l border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100">
                          <span className="w-[500px] flex-1 text-left">{generatedToken || "pickle-relish-olives-anchovies-mustard"}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            onClick={() => navigator.clipboard.writeText(generatedToken)}
                          >
                            <Copy className="h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                    <Button onClick={handleGenerateToken} className="bg-gray-800 py-2 text-sm text-white hover:bg-gray-900" size="sm">
                      <Dollar className="mr-2 h-4 w-4" />
                      Create token
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3 - Installation Monitor Card */}
            {selectedStep === 3 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">During the installation, monitor progress here</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    Follow the progress of your installation below. You&apos;re able to view the installation logs during the process.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-1 flex justify-between text-sm text-gray-600 dark:text-gray-300">
                        <span>Progress</span>
                        <span>0%</span>
                      </div>
                      <Progress value={0} className="w-full" />
                    </div>
                    <Button onClick={handleMonitorInstallation} variant="outline" className="py-2 text-sm" size="sm">
                      <StatsReport className="mr-2 h-4 w-4" />
                      View installation log
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 4 - Dashboard Preview */}
            {selectedStep === 4 && (
              <Card className="shadow-sm">
                <CardHeader className="pb-3 text-center">
                  <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">Monitor your device on your dashboard</CardTitle>
                </CardHeader>
                <CardContent className="pt-0 text-center">
                  <p className="mb-6 text-sm text-gray-600 dark:text-gray-300">
                    Your Akash HomeNode is now set up and ready to start earning. Monitor your device on your dashboard.
                  </p>
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
                      <CardContent className="p-3 text-center">
                        <div className="mb-2 flex justify-center">
                          <Dollar className="h-6 w-6 text-green-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Earnings</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Track your rewards</p>
                      </CardContent>
                    </Card>
                    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20">
                      <CardContent className="p-3 text-center">
                        <div className="mb-2 flex justify-center">
                          <Clock className="h-6 w-6 text-blue-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Uptime</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Monitor availability</p>
                      </CardContent>
                    </Card>
                    <Card className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-900/20">
                      <CardContent className="p-3 text-center">
                        <div className="mb-2 flex justify-center">
                          <Activity className="h-6 w-6 text-purple-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Utilization</h4>
                        <p className="text-xs text-gray-600 dark:text-gray-300">Resource usage</p>
                      </CardContent>
                    </Card>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">Monitor your device on your dashboard</p>
        </div>
      </div>
    </div>
  );
}
