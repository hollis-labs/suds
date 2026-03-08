"use client";

import { cn } from "@/lib/utils";
import { SpriteIcon } from "./SpriteIcon";
import type { SpriteId } from "@/lib/sprites";

interface PixelCardProps {
  title?: string;
  icon?: SpriteId;
  children: React.ReactNode;
  className?: string;
}

export function PixelCard({ title, icon, children, className }: PixelCardProps) {
  return (
    <div
      className={cn(
        "border-2 border-gray-600 bg-gray-900/95 rounded-sm",
        "shadow-[2px_2px_0_0_rgba(0,0,0,0.5)]",
        className
      )}
      style={{ imageRendering: "pixelated" }}
    >
      {title && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b-2 border-gray-600 bg-gray-800/80">
          {icon && <SpriteIcon spriteId={icon} size={18} />}
          <span className="font-mono text-sm text-gray-200 font-bold truncate">
            {title}
          </span>
        </div>
      )}
      <div className="p-3">{children}</div>
    </div>
  );
}
