import React from "react";
import { cn } from "@/lib/utils";

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline";
  icon?: React.ReactNode;
}

const ActionButton = ({ variant = "primary", icon, className, children, ...props }: ActionButtonProps) => {
  const variantClasses = {
    primary: "bg-gradient-to-r from-mello-purple to-mello-lightPurple text-white shadow-md",
    outline: "bg-white border border-[#cccac6] text-foreground",
  };

  return (
    <button
      className={cn(
        "flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 hover:scale-105 active:scale-95",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
};

export default ActionButton;