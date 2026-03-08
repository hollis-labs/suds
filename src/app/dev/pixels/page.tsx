"use client";

import { useState } from "react";
import { SpriteIcon } from "@/components/pixel/SpriteIcon";
import { PixelButton } from "@/components/pixel/PixelButton";
import { PixelBadge } from "@/components/pixel/PixelBadge";
import { HudBar } from "@/components/pixel/HudBar";
import { Breadcrumb } from "@/components/pixel/Breadcrumb";
import { ContextDrawer } from "@/components/pixel/ContextDrawer";
import { PixelCard } from "@/components/pixel/PixelCard";
import { SPRITES, type SpriteId } from "@/lib/sprites";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-mono text-lg text-amber-400 mb-3 border-b border-gray-700 pb-1">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PixelDevPage() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const spriteGroups: Record<string, SpriteId[]> = {};
  for (const id of Object.keys(SPRITES) as SpriteId[]) {
    const prefix = id.split("_")[0];
    if (!spriteGroups[prefix]) spriteGroups[prefix] = [];
    spriteGroups[prefix].push(id);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6">
      <h1 className="font-mono text-2xl text-white mb-1">Pixel Component Library</h1>
      <p className="font-mono text-xs text-gray-500 mb-6">
        /dev/pixels — Sprint 2 component demo
      </p>

      {/* HudBar */}
      <Section title="HudBar">
        <div className="rounded overflow-hidden border border-gray-700">
          <HudBar hp={24} maxHp={30} mp={12} maxMp={15} gold={150} level={5} />
        </div>
      </Section>

      {/* Breadcrumb */}
      <Section title="Breadcrumb">
        <div className="rounded overflow-hidden border border-gray-700">
          <Breadcrumb
            onBack={() => alert("Back")}
            segments={[
              { label: "Aethermoor", onClick: () => alert("World") },
              { label: "Ashen Coast", onClick: () => alert("Region") },
              { label: "Blackmere Village", onClick: () => alert("Area") },
              { label: "The Rusty Tankard" },
            ]}
          />
        </div>
      </Section>

      {/* PixelButton variants */}
      <Section title="PixelButton">
        <div className="flex flex-wrap gap-3 mb-4">
          <PixelButton variant="action">Action</PixelButton>
          <PixelButton variant="nav">Navigate</PixelButton>
          <PixelButton variant="danger">Danger</PixelButton>
          <PixelButton variant="info">Info</PixelButton>
          <PixelButton disabled>Disabled</PixelButton>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <PixelButton variant="action" size="sm">Small</PixelButton>
          <PixelButton variant="action" size="md">Medium</PixelButton>
          <PixelButton variant="action" size="lg">Large</PixelButton>
        </div>
      </Section>

      {/* PixelBadge */}
      <Section title="PixelBadge">
        <div className="flex flex-wrap gap-4">
          <PixelBadge type="hp" value={24} max={30} />
          <PixelBadge type="mp" value={12} max={15} />
          <PixelBadge type="gold" value={150} />
          <PixelBadge type="level" value={5} />
          <PixelBadge type="attack" value={18} />
          <PixelBadge type="defense" value={12} />
        </div>
      </Section>

      {/* PixelCard */}
      <Section title="PixelCard">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
          <PixelCard title="Inventory" icon="ui_chest">
            <p className="font-mono text-xs text-gray-400">
              3 items in your pack
            </p>
          </PixelCard>
          <PixelCard title="The Rusty Tankard" icon="building_tavern">
            <p className="font-mono text-xs text-gray-400">
              A warm glow spills from the windows of this well-worn establishment.
            </p>
          </PixelCard>
          <PixelCard>
            <p className="font-mono text-xs text-gray-400">
              Card with no header — used for inline content.
            </p>
          </PixelCard>
        </div>
      </Section>

      {/* ContextDrawer */}
      <Section title="ContextDrawer">
        <PixelButton variant="info" onClick={() => setDrawerOpen(true)}>
          Open Drawer
        </PixelButton>
        <ContextDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          title="Room Details"
        >
          <PixelCard title="The Dusty Corridor" icon="terrain_stone">
            <p className="font-mono text-xs text-gray-400 mb-2">
              A long stone corridor stretches before you. Torches flicker on the walls.
            </p>
            <div className="flex gap-2">
              <PixelButton variant="action" size="sm">Explore</PixelButton>
              <PixelButton variant="nav" size="sm">Move</PixelButton>
            </div>
          </PixelCard>
        </ContextDrawer>
      </Section>

      {/* All Sprites */}
      <Section title="SpriteIcon — All Sprites">
        {Object.entries(spriteGroups).map(([prefix, ids]) => (
          <div key={prefix} className="mb-4">
            <h3 className="font-mono text-sm text-gray-400 mb-2 capitalize">{prefix}</h3>
            <div className="flex flex-wrap gap-3 items-end">
              {ids.map((id) => (
                <div key={id} className="flex flex-col items-center gap-1">
                  <SpriteIcon spriteId={id} size={48} />
                  <span className="font-mono text-[10px] text-gray-600 max-w-[60px] text-center truncate">
                    {id}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* Sprite size comparison */}
      <Section title="SpriteIcon — Size Scaling">
        <div className="flex flex-wrap gap-4 items-end">
          {[16, 24, 32, 48, 64, 96].map((size) => (
            <div key={size} className="flex flex-col items-center gap-1">
              <SpriteIcon spriteId="marker_player" size={size} />
              <span className="font-mono text-[10px] text-gray-600">{size}px</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
