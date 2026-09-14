import { rm, readFile, writeFile, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

await rm('dist', { recursive: true, force: true });

const mockDbPath = 'server/mockDb.ts';
let mockDb = await readFile(mockDbPath, 'utf8');
const mockTypes = ['MockUser','MockPump','MockFuel','MockTransaction','MockPointEntry','MockCoupon','MockAuditLog','MockCustomer','MockCustomerVehicle','MockCustomerSession'];
for (const typeName of mockTypes) {
  const marker = `interface ${typeName} {`;
  const replacement = `${marker}\n  [key: string]: unknown;`;
  if (mockDb.includes(marker) && !mockDb.includes(`${marker}\n  [key: string]: unknown;`)) mockDb = mockDb.replace(marker, replacement);
}
await writeFile(mockDbPath, mockDb);

const result = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vite', 'build'], { stdio: 'inherit', shell: false });
if (result.status !== 0) process.exit(result.status ?? 1);

const admin = await readFile('dist/admin.html', 'utf8');
const required = ['admin-2026-09-14.1','FuelPulse does not generate passwords','name="ownerCode"','name="ownerPassword"','ownerPasswordConfirm'];
const forbidden = ['Generated automatically','temporaryPassword','temporary_password','Generate owner credentials','name="stationId" id="stationId" placeholder="Generated automatically" readonly'];
for (const marker of required) if (!admin.includes(marker)) throw new Error(`Admin build verification failed: missing ${marker}`);
for (const marker of forbidden) if (admin.includes(marker)) throw new Error(`Admin build verification failed: stale content detected (${marker})`);
await copyFile('dist/admin.html', 'dist/admin-v7.html');
console.log('Admin portal build verified:', 'dist/admin-v7.html');
