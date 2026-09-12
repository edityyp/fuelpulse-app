# FuelPulse Phase 2 — AI & Recognition

Phase 2 has started. The existing FastALPR backend is already the primary recognition engine with multi-variant image enhancement and consensus. The next implementation targets are:

1. Strengthen live multi-frame consensus so near-identical OCR results (including truncated suffixes) are merged instead of requiring exact frame matches.
2. Keep FastALPR as primary and browser OCR only as fallback.
3. Add practical AI sales analysis from server-confirmed transaction data.
4. Add practical AI fraud analysis using existing fraud flags and transaction patterns.
5. Add a small, safe voice-command set for common station actions.
6. Preserve all existing security, tenant isolation, RLS, custom session auth, and excluded-feature constraints.

Phase 1 digital receipts remain explicitly download-only and are not replaced with WhatsApp functionality.
