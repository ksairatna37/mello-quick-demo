import React from "react";

const LoadingDots = () => {
  return (
    <div className="flex items-center space-x-1">
      <div className="h-2 w-2 animate-[bounce_1s_infinite_0ms] rounded-full bg-gray-500/50"></div>
      <div className="h-2 w-2 animate-[bounce_1s_infinite_200ms] rounded-full bg-gray-500/50"></div>
      <div className="h-2 w-2 animate-[bounce_1s_infinite_400ms] rounded-full bg-gray-500/50"></div>
    </div>
  );
};

export default LoadingDots;