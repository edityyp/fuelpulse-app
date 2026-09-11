import { runMigrations, MigrationSafetyError } from './migration-runner.js';

const connectionString = process.env.MIGRATION_DATABASE_URL;
if (!connectionString) throw new Error('MIGRATION_DATABASE_URL required; inspect target before applying');
try {
  const result = await runMigrations({
    connectionString,
    directory: 'supabase/migrations',
    privateMetadataConfirmed: process.env.FUELPULSE_PRIVATE_METADATA_CONFIRMED === 'true',
  });
  console.log(`Migration transaction committed: ${result.applied.length} applied, ${result.skipped} already recorded.`);
} catch (error) {
  // Never serialize pg connection configuration, URLs or SQL/secret-bearing error objects.
  console.error(error instanceof MigrationSafetyError ? error.message : 'Migration failed; transaction rolled back unless commit outcome is uncertain. Inspect history before retrying.');
  process.exitCode = 1;
}
