# FuelPulse Product Roadmap

This roadmap is intentionally limited to the feature set approved for the next build.

## Phase 1 — Operations & UX

- Advanced owner dashboard
- Staff performance
- Digital receipts: **download only**, no WhatsApp sending
- Reports & exports
- Smart alerts
- Fix Vehicle Owner page
- Improve mobile layout without degrading desktop UI
- Add consistent icons and restrained micro-animations

## Phase 2 — AI & recognition

- FastALPR as the primary number-plate engine
- Multi-frame recognition and confidence consensus
- Image enhancement for small/blurred/mobile-camera plates
- Preserve suffix characters instead of accepting truncated OCR readings
- FastALPR fallback to browser OCR when appropriate
- AI FuelPulse Assistant
- AI sales analysis
- AI fraud analysis
- Small practical voice-command set

## Phase 3 — Customer & multi-station

- Multi-station management
- Customer profiles
- Advanced loyalty
- Customer PWA

## Explicit exclusions

The following are intentionally out of scope for this roadmap:

- Tank/inventory management
- Pump/nozzle meter management
- Shift management
- Fuel delivery management
- Profit/margin system
- Fleet management
- Subscription/billing
- WhatsApp receipt sending or WhatsApp integration

## Current implementation checkpoint

The FastALPR recognition worker now evaluates the original frame plus sharpened/upscaled and CLAHE-enhanced variants. Candidate readings are consolidated so a longer, compatible plate suffix can win over an intermittently truncated reading. The customer scanner UI has also been made more mobile-friendly.
