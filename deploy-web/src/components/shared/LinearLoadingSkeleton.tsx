import { Progress } from "@src/components/ui/progress";
import { useEffect, useState } from "react";

interface IProps {
  isLoading: boolean;
}

export function LinearLoadingSkeleton({ isLoading }: IProps) {
  const [progress, setProgress] = useState(13);

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress(prev => {
        const rest = 100 - prev;
        const increment = Math.random() * rest;
        const newProgress = prev + Math.max(increment, 13);
        return newProgress >= 100 ? 0 : newProgress;
      });
    }, 500);

    return () => clearInterval(timer);
  }, []);

  return <>{isLoading ? <Progress className="h-[4px] w-full" value={progress} color="secondary" /> : <div className="h-[4px] w-full" />}</>;
}
