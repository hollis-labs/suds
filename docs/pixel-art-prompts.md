# Pixel Art Sprite Prompts — Nanobanana

Use these prompts with nanobanana (or similar pixel art AI generator) to create the sprites needed for the SUDS v2 world redesign.

## Style Guide

All sprites should share these properties:
- **Size:** 16x16 pixels (terrain, markers, UI icons) or 32x32 (buildings, banners)
- **Palette:** Dark fantasy RPG palette — muted earth tones, deep shadows, selective bright accents
- **Style:** Top-down RPG perspective for terrain/markers. Front-facing for UI icons.
- **Background:** Transparent PNG
- **Outline:** 1px dark outline on all sprites for readability against dark backgrounds
- **Color depth:** Limited palette (~16-24 colors max across the sheet for cohesion)

Reference palette (approximate hex values):
- Background/void: `#0a0a0a`
- Grass dark: `#2d5a1e`, light: `#4a8c2a`
- Stone dark: `#3a3a3a`, light: `#6b6b6b`
- Water dark: `#1a3a5c`, light: `#2a6ab0`
- Wood: `#5a3a1a`, light: `#8b6b3a`
- Gold accent: `#d4a017`
- Red accent (danger/HP): `#c0392b`
- Blue accent (MP/info): `#2980b9`
- Green accent (action/safe): `#27ae60`
- Purple accent (magic): `#8e44ad`

---

## Prompt Pack 1: Terrain Tiles (16x16)

### Prompt 1A — Ground Tiles
```
Create a pixel art sprite sheet, 16x16 pixels per tile, arranged in a single horizontal row, top-down RPG perspective. Dark fantasy style with muted earth tones.

Tiles left to right:
1. Grass tile — dark green with subtle texture variation, a few darker spots suggesting depth
2. Stone floor tile — gray cobblestone pattern, slightly uneven surface with mortar lines
3. Water tile — deep blue with 2-frame ripple animation suggestion (static frame is fine), darker edges
4. Road/path tile — packed dirt/gravel, lighter than grass, subtle wear marks
5. Forest tile — dense tree canopy viewed from above, very dark green with trunk spots
6. Mountain tile — rocky gray with snow-capped peak suggestion, impassable looking
7. Sand tile — warm tan with subtle wind-swept texture
8. Dirt tile — brown earth, a few small pebbles, transition-friendly edges

All tiles should seamlessly tile when placed adjacent to copies of themselves. 1px dark outline. Transparent background.
```

### Prompt 1B — Interior/Dungeon Tiles
```
Create a pixel art sprite sheet, 16x16 pixels per tile, top-down RPG perspective. Dark dungeon aesthetic.

Tiles left to right:
1. Dungeon wall — dark stone block wall viewed from above, torch-lit highlight on one edge
2. Dungeon door — wooden door in stone frame, iron bands, slightly ajar
3. Stairs going up — stone spiral staircase viewed from above, lighter toward the top
4. Stairs going down — stone spiral staircase viewed from above, darker toward the bottom
5. Bridge tile — wooden planks over dark void/water, rope railings
6. Cracked floor — broken stone tiles with glowing cracks (lava or magic beneath)

Dark palette. 1px outline. Transparent background. Tiles should work on a dark (#0a0a0a) background.
```

---

## Prompt Pack 2: Building Icons (32x32)

### Prompt 2A — Town Buildings
```
Create a pixel art sprite sheet, 32x32 pixels per icon, top-down/isometric-hint RPG style. These are building icons for an overhead town map.

Icons left to right:
1. Tavern — small medieval pub with a hanging sign, warm light from windows, pitched roof, chimney with smoke
2. Shop — merchant storefront with an awning, barrel and crate outside, hanging goods
3. Temple — stone building with a pointed spire or dome, glowing symbol above door, holy/sacred feel
4. House — simple medieval cottage, thatched or shingled roof, small fence
5. Castle gate — imposing stone gatehouse with portcullis, banners on towers, larger and grander than other buildings

Dark fantasy palette. 1px dark outline. Transparent background. Each building should be clearly distinct at small sizes.
```

### Prompt 2B — Special Buildings
```
Create a pixel art sprite sheet, 32x32 pixels per icon, top-down/isometric-hint RPG style.

Icons left to right:
1. Dungeon entrance — dark cave mouth or stone archway leading underground, ominous, green/purple glow from within
2. Tower — tall narrow wizard tower, glowing window at top, arcane symbols
3. Ruins — crumbled stone walls, overgrown with vines, mysterious and explorable

Dark fantasy palette. 1px dark outline. Transparent background.
```

---

## Prompt Pack 3: Markers (16x16)

### Prompt 3A — Map Markers
```
Create a pixel art sprite sheet, 16x16 pixels per icon, designed to overlay on top of terrain tiles.

Icons left to right:
1. Player marker — small humanoid figure or chevron/arrow, bright green, clearly visible on any terrain
2. NPC marker — small humanoid figure with a distinctive hat or exclamation mark, yellow/gold
3. Loot marker — small sparkling chest or shining bag, gold with white sparkle pixels
4. Encounter marker — red crossed swords or skull, indicating danger
5. Entrance marker — downward arrow or door icon, indicating building/dungeon entrance
6. Quest marker — floating exclamation mark, bright yellow, RPG quest indicator style
7. Campfire marker — small orange/yellow flame, indicating safe room
8. Other player marker — humanoid figure similar to player marker but blue, indicating another player

All markers should be semi-transparent or have a subtle glow/shadow so they layer well over terrain. Bright, high-contrast colors for visibility.
```

---

## Prompt Pack 4: UI Icons (16x16)

### Prompt 4A — HUD Badge Icons
```
Create a pixel art sprite sheet, 16x16 pixels per icon, front-facing style for use in a game HUD. These will appear next to numerical values.

Icons left to right:
1. Heart — classic pixel heart, red with highlight, represents HP
2. Mana drop — blue teardrop/crystal, represents MP
3. Gold coin — shiny gold coin with subtle shine animation frame, represents gold currency
4. Star — green/gold star, represents character level
5. Sword — small steel sword, represents attack power
6. Shield — small round or kite shield, represents defense/AC
7. Skull — small white/gray skull, represents death or danger rating
8. Chest — small wooden chest with gold trim, represents inventory/loot

Clean, iconic, instantly readable at small sizes. 1px outline. Transparent background.
```

---

## Prompt Pack 5: UI Buttons (variable width)

### Prompt 5A — Pixel Button Borders
```
Create a pixel art 9-slice button template set. Each template should be a 48x16 pixel button that can be sliced into 9 sections for scaling. Stepped pixel corners (not rounded, not sharp — classic RPG menu style).

Buttons (one per row):
1. Action button — green border and background tint, "primary action" feel
2. Navigation button — gold/amber border and background tint, "go there" feel
3. Danger button — red border and background tint, "warning/combat" feel
4. Info button — blue border and background tint, "information/inspect" feel
5. Disabled button — gray border and background tint, desaturated feel

Each button should have:
- A dark interior (#1a1a1a or similar)
- A 2px pixel border in the variant color
- Stepped corners (2x2 pixel cut on each corner)
- A subtle 1px inner highlight on top edge (lighter shade)
- A subtle 1px shadow on bottom edge (darker shade)

These will be sliced and stretched via CSS to accommodate any text content.
```

---

## Prompt Pack 6: Region Banners (64x64)

### Prompt 6A — Region Identity Art
```
Create a pixel art sprite sheet, 64x64 pixels per banner, front-facing heraldic style. These represent different world regions in a dark fantasy RPG.

Banners left to right:
1. "Ashen Coast" — a banner/crest featuring crashing dark waves against jagged cliffs, skull or shipwreck motif, dark blue/gray palette with red accent. Horror/dread theme.
2. "Verdant Vale" — a banner/crest featuring an ancient tree with glowing leaves, deer or forest spirit silhouette, deep green/gold palette. Nature/life theme.
3. "Iron Peaks" — a banner/crest featuring a mountain fortress with crossed hammers or axes, forge fire glow, dark gray/orange palette. Strength/industry theme.

Each banner should look like a faction crest or coat of arms. Rich detail for the larger size. Dark background. 1px outline.
```

---

## Prompt Pack 7: Character Sprites (optional, post-MVP)

### Prompt 7A — Class Icons
```
Create a pixel art sprite sheet, 32x32 pixels per icon, front-facing RPG portrait style. Small character busts for class selection and character sheets.

Classes left to right (row 1):
1. Fighter — armored warrior with sword and shield, determined expression
2. Wizard — robed figure with staff, glowing eyes, arcane energy
3. Rogue — hooded figure with daggers, shadowy, smirking
4. Cleric — holy warrior with mace and holy symbol, serene

Classes left to right (row 2):
5. Barbarian — wild-haired muscular figure, furs, rage in eyes
6. Bard — charismatic figure with lute, feathered hat, wink
7. Druid — nature figure with antlers/leaves in hair, animal companion hint
8. Monk — bald or topknot, martial arts pose, calm intensity

Classes left to right (row 3):
9. Paladin — gleaming armor with holy glow, righteous
10. Ranger — woodland figure with bow, animal companion hint, focused
11. Sorcerer — wild magic energy around hands, confident
12. Warlock — dark pact symbols, eldritch glow, mysterious

Dark fantasy palette consistent with other sprites. 1px outline. Transparent background.
```

---

## Usage Notes

- Generate each prompt pack separately for best results
- Review and hand-edit any sprites that don't tile well or are hard to read at actual size
- Export as PNG with transparency
- Assemble into a single sprite sheet (`public/sprites/sheet.png`) using a sprite packer or manually
- Update `src/lib/sprites.ts` with the final tile positions after assembly
- Terrain tiles MUST tile seamlessly — test by placing 4 copies in a 2x2 grid
- All sprites should be clearly distinguishable at 1x (16px) and 2x (32px) display size
