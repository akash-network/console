import { useEffect } from "react";
import { useRouter } from "next/router";

import { ModeSelector } from "@src/components/auth/ModeSelector";
import { useAuth } from "@src/context/AuthProvider";

export default function Home() {
  const { authMode, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is already authenticated, redirect to appropriate dashboard
    if (isAuthenticated) {
      if (authMode === "akash-at-home") {
        router.push("/akash-at-home/dashboard");
      } else {
        router.push("/provider-dashboard");
      }
    }
  }, [isAuthenticated, authMode, router]);

  return <ModeSelector />;
}
