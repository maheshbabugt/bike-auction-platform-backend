import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const source = resolve(backendRoot, 'src/generated/prisma');
const destination = resolve(backendRoot, 'dist/generated/prisma');

await mkdir(dirname(destination), { recursive: true });
await cp(source, destination, { recursive: true, force: true });

console.log('Copied Prisma generated client to dist/generated/prisma');
