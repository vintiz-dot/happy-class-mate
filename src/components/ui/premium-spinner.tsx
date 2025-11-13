import * as React from "react";
import { cn } from "@/lib/utils";

interface PremiumSpinnerProps {
  variant?: "orbital" | "pulse" | "dots" | "ring";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function PremiumSpinner({ 
  variant = "orbital", 
  size = "md",
  className 
}: PremiumSpinnerProps) {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-8 h-8",
    lg: "w-12 h-12"
  };

  if (variant === "orbital") {
    return (
      <div className={cn("relative", sizeClasses[size], className)}>
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin" />
        <div className="absolute inset-1 rounded-full border-2 border-transparent border-t-accent animate-spin" style={{ animationDuration: "0.8s", animationDirection: "reverse" }} />
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div className={cn("relative", sizeClasses[size], className)}>
        <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        <div className="absolute inset-0 rounded-full bg-primary animate-pulse" />
      </div>
    );
  }

  if (variant === "dots") {
    const dotSize = size === "sm" ? "w-1.5 h-1.5" : size === "md" ? "w-2 h-2" : "w-3 h-3";
    return (
      <div className={cn("flex gap-1 items-center", className)}>
        <div className={cn("rounded-full bg-primary animate-bounce", dotSize)} style={{ animationDelay: "0ms" }} />
        <div className={cn("rounded-full bg-primary animate-bounce", dotSize)} style={{ animationDelay: "150ms" }} />
        <div className={cn("rounded-full bg-primary animate-bounce", dotSize)} style={{ animationDelay: "300ms" }} />
      </div>
    );
  }

  // ring variant (default fallback)
  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      <div className="absolute inset-0 rounded-full border-4 border-primary/20" />
      <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary animate-spin" />
    </div>
  );
}
