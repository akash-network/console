import React from "react";
import { Loader2 } from "lucide-react";

export const Icons = {
  spinner: Loader2
};

export const SpinningLoader: React.FC = () => {
  return <Icons.spinner className="h-4 w-4 animate-spin" />;
};

const Loading: React.FC = () => {
  return (
    <div className="flex items-center justify-center">
      <svg className="-ml-1 mr-3 h-5 w-5 animate-spin text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647zM12 20a8 8 0 01-8-8H0c0 6.627 5.373 12 12 12v-4zm4-5.291A7.962 7.962 0 0120 12h-4c0 3.042-1.135 5.824-3 7.938l3-2.647z"
        ></path>
      </svg>
      <span>Loading...</span>
    </div>
  );
};

export default Loading;
