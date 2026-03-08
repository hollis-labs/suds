"use client";

import { cn } from "@/lib/utils";
import { SPRITES } from "@/lib/sprites";
import type { ButtonHTMLAttributes } from "react";

type PixelButtonVariant = "action" | "nav" | "danger" | "info";

interface PixelButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PixelButtonVariant;
  size?: "sm" | "md" | "lg";
}

const VARIANT_SPRITES = {
  action: SPRITES.btn_action,
  nav: SPRITES.btn_nav,
  danger: SPRITES.btn_danger,
  info: SPRITES.btn_info,
} as const;

const VARIANT_COLORS = {
  action: "text-green-100 hover:text-white",
  nav: "text-amber-100 hover:text-white",
  danger: "text-red-100 hover:text-white",
  info: "text-blue-100 hover:text-white",
} as const;

const SIZE_CLASSES = {
  sm: "px-3 py-1 text-xs min-h-[28px]",
  md: "px-5 py-1.5 text-sm min-h-[36px]",
  lg: "px-7 py-2 text-base min-h-[44px]",
} as const;

export function PixelButton({
  variant = "action",
  size = "md",
  disabled,
  className,
  children,
  ...props
}: PixelButtonProps) {
  const sprite = disabled ? SPRITES.btn_disabled : VARIANT_SPRITES[variant];
  const { sheet, region } = sprite;

  return (
    <button
      disabled={disabled}
      className={cn(
        "relative inline-flex items-center justify-center font-mono font-bold tracking-wide",
        "transition-transform active:translate-y-px",
        "cursor-pointer disabled:cursor-not-allowed disabled:opacity-60",
        disabled ? "text-gray-400" : VARIANT_COLORS[variant],
        SIZE_CLASSES[size],
        className
      )}
      style={{
        background: "transparent",
        border: "none",
      }}
      {...props}
    >
      {/* Sprite border background using border-image for proper 9-slice scaling */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `url(${sheet.src})`,
          backgroundSize: `${(sheet.width / region.w) * 100}% ${(sheet.height / region.h) * 100}%`,
          backgroundPosition: `${(-region.x / region.w) * 100}% ${(-region.y / region.h) * 100}%`,
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />
      <span className="relative z-10 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
        {children}
      </span>
    </button>
  );
}
