"use client";
import LinearProgress from "@mui/material/LinearProgress";

interface IProps {
  isLoading: boolean;
}

export function LinearLoadingSkeleton({ isLoading }: IProps) {
  return <>{isLoading ? <LinearProgress color="primary" /> : <div className="h-[4px] w-full min-w-0" />}</>;
}
