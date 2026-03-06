# ADR-002: Terminal Web Aesthetic over Real Terminal

## Status
Accepted

## Context
SUDS v1 was a real TUI (Bubble Tea/Go). V2 needs cross-platform web support including mobile.

## Decision
Build a web app that looks like a terminal rather than a real terminal in browser (xterm.js etc). Use React components styled with monospace fonts, dark backgrounds, ASCII characters, and terminal-like animations (typing, scanlines, glow).

## Rationale
- Full control over UI/UX: modals, forms, tooltips, responsive design
- Can add GUI features (clickable buttons, hover states) while maintaining aesthetic
- No terminal emulator overhead or escape sequence handling
- Easier to make responsive for mobile/tablet
- Can progressively enhance without breaking terminal feel

## Consequences
- Custom component library needed (Terminal*, Game* components)
- Must maintain visual consistency manually
- More CSS work than a real terminal, but more flexible
