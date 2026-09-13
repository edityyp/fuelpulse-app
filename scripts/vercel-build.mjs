import { rm, readFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });

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
