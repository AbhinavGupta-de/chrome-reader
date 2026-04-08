import React from "react";

interface ProgressBarProps {
  percentage: number;
}

export default function ProgressBar({ percentage }: ProgressBarProps) {
  return (
    <div className="h-[2px] w-full bg-oat-light relative z-50">
      <div
        className="h-full bg-matcha-600 transition-[width] duration-150 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
      />
    </div>
  );
}
