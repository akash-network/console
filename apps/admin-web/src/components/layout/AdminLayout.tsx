"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ErrorFallback, Spinner } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { useUser } from "@auth0/nextjs-auth0/client";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

const ALLOWED_DOMAIN = "akash.network";

interface Props {
  children?: ReactNode;
  isLoading?: boolean;
}

export function AdminLayout({ children, isLoading }: Props) {
  const { user, isLoading: isAuthLoading } = useUser();

  const userEmail = user?.email?.toLowerCase() || "";
  const userDomain = userEmail.split("@")[1];
  const isAuthorized = !user || userDomain === ALLOWED_DOMAIN;

  useEffect(() => {
    if (user && !isAuthorized) {
      window.location.href = "/unauthorized";
    }
  }, [user, isAuthorized]);

  if (isAuthLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="large" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Please sign in to continue</p>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/api/auth/login" className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2">
            Sign In
          </a>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="large" />
          <p className="text-muted-foreground">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="bg-background flex-1 overflow-y-auto">
          <ErrorBoundary FallbackComponent={ErrorFallback}>
            {isLoading ? (
              <div className="flex h-full w-full items-center justify-center">
                <Spinner size="large" />
              </div>
            ) : (
              <div className={cn("container p-6")}>{children}</div>
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default AdminLayout;
