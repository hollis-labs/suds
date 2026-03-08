"use client";

import { cn } from "@/lib/utils";
import { getSprite, type SpriteId } from "@/lib/sprites";

interface SpriteIconProps {
  spriteId: SpriteId;
  /** Display size in pixels (sprites scale to fit this square) */
  size?: number;
  className?: string;
}

export function SpriteIcon({ spriteId, size = 32, className }: SpriteIconProps) {
  const sprite = getSprite(spriteId);
  const { sheet, region } = sprite;

  // Scale factor: how much to scale the sheet so the sprite region fits `size`
  const scaleX = size / region.w;
  const scaleY = size / region.h;

  // Use the smaller scale to maintain aspect ratio, fitting within the size
  const scale = Math.min(scaleX, scaleY);

  const bgWidth = sheet.width * scale;
  const bgHeight = sheet.height * scale;
  const bgX = -(region.x * scale);
  const bgY = -(region.y * scale);

  const displayW = region.w * scale;
  const displayH = region.h * scale;

  return (
    <div
      className={cn("inline-block shrink-0", className)}
      style={{
        width: displayW,
        height: displayH,
        backgroundImage: `url(${sheet.src})`,
        backgroundPosition: `${bgX}px ${bgY}px`,
        backgroundSize: `${bgWidth}px ${bgHeight}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
      role="img"
      aria-label={sprite.label}
    />
  );
}
