"use client";

import { cn } from "@/lib/utils";

export interface BreadcrumbSegment {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
  onBack?: () => void;
  className?: string;
}

export function Breadcrumb({ segments, onBack, className }: BreadcrumbProps) {
  return (
    <nav
      className={cn(
        "flex items-center gap-1 px-3 py-1.5 bg-black/60 border-b border-gray-800",
        "overflow-x-auto scrollbar-none font-mono text-xs",
        className
      )}
      aria-label="Navigation breadcrumb"
    >
      {onBack && (
        <button
          onClick={onBack}
          className="shrink-0 px-1.5 py-0.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
          aria-label="Go back"
        >
          &larr;
        </button>
      )}
      {segments.map((segment, i) => {
        const isLast = i === segments.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1 shrink-0">
            {i > 0 && (
              <span className="text-gray-600" aria-hidden>&gt;</span>
            )}
            {isLast || !segment.onClick ? (
              <span className={cn(isLast ? "text-white" : "text-gray-500")}>
                {segment.label}
              </span>
            ) : (
              <button
                onClick={segment.onClick}
                className="text-amber-400 hover:text-amber-200 transition-colors cursor-pointer"
              >
                {segment.label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
