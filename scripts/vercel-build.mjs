import { rm, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });

// The mock database intentionally models typed domain rows, while executeQuery
// exposes PostgreSQL-style generic records. Add the index signature required by
// that boundary in the build workspace so Vercel's TypeScript validation agrees
// with the runtime contract without weakening tsconfig globally.
const mockDbPath = 'server/mockDb.ts';
let mockDb = await readFile(mockDbPath, 'utf8');
const mockTypes = [
  'MockUser',
  'MockPump',
  'MockFuel',
  'MockTransaction',
  'MockPointEntry',
  'MockCoupon',
  'MockAuditLog',
  'MockCustomer',
  'MockCustomerVehicle',
  'MockCustomerSession',
];
for (const typeName of mockTypes) {
  const marker = `interface ${typeName} {`;
  const replacement = `${marker}\n  [key: string]: unknown;`;
  if (mockDb.includes(marker) && !mockDb.includes(`${marker}\n  [key: string]: unknown;`)) {
    mockDb = mockDb.replace(marker, replacement);
  }
}
await writeFile(mockDbPath, mockDb);

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], {
  stdio: 'inherit',
  shell: false,
});

if (result.status !== 0) process.exit(result.status ?? 1);

const admin = await readFile('dist/admin.html', 'utf8');
const required = [
  "admin-2026-09-13.7",
  'Generated automatically',
  'valueFrom(d',
  'Copy failed',
];
const forbidden = [
  'PRIVATE CONTROL PLANE',
  'e.currentTarget.reset()',
  'name="stationId" placeholder="example-fuel" pattern=',
];

for (const marker of required) {
  if (!admin.includes(marker)) throw new Error(`Admin build verification failed: missing ${marker}`);
}
for (const marker of forbidden) {
  if (admin.includes(marker)) throw new Error(`Admin build verification failed: stale content detected (${marker})`);
}

// Publish the verified admin artifact under a build-specific filename so a stale
// Vercel/static-cache artifact can never satisfy the /admin rewrite.
await copyFile('dist/admin.html', 'dist/admin-v7.html');
console.log('Admin portal build verified:', 'dist/admin-v7.html');
