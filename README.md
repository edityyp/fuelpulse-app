# FuelPulse

Reconstruction IN PROGRESS. Permanent source: https://github.com/edityyp/fuelpulse-app . The previous source was lost; previous tests are historical only. See IMPLEMENTATION_STATUS.md for current verification.

Architecture: React/TypeScript/Vite PWA → same-origin Fastify Node 24 API → PostgreSQL 17 (local or Supabase hosted). Staff-code authentication, server-calculated business values, mandatory tenant RLS. No browser database secrets.

Never deploy an unverified checkpoint. Application source is committed incrementally before sandbox testing to prevent source loss. GitHub is authoritative; the sandbox is a disposable working copy.
