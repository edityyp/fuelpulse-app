# FuelPulse Private Admin Portal

This directory is reserved for the private administrative control plane.

The admin portal must be authenticated server-side and must never rely on the `/admin` URL alone for authorization.

Customer owners remain tenant-scoped `OWNER` users. Admin identity/session handling must remain separate from `app.users` so a customer owner can never become an admin through tenant role changes.
