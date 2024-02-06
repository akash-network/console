"use client";
import { Progress } from "@src/components/ui/progress";
import { useEffect, useState } from "react";

interface IProps {
  isLoading: boolean;
}

export function LinearLoadingSkeleton({ isLoading }: IProps) {
  const [progress, setProgress] = useState(13);

  useEffect(() => {
    let timer;

    if (!isLoading) {
      setProgress(0);
      clearInterval(timer);
    } else {
      timer = setInterval(() => {
        setProgress(prev => {
          const rest = 100 - prev;
          const maxPercent = prev > 75 ? 10 : 35;
          const randomPercent = randomIntFromInterval(1, maxPercent);
          const increment = (randomPercent / 100) * rest;
          const newProgress = Math.min(prev + increment, 100);
          return newProgress;
        });
      }, 500);
    }

    return () => clearInterval(timer);
  }, [isLoading]);

  function randomIntFromInterval(min: number, max: number) {
    return Math.floor(Math.random() * (max - min + 1) + min);
  }

  return <>{isLoading ? <Progress className="h-[4px] w-full min-w-0" value={progress} color="secondary" /> : <div className="h-[4px] w-full min-w-0" />}</>;
}
