import { rmSync } from 'node:fs';
import { join } from 'node:path';

const localDataDir = join(process.cwd(), '.local-data');

const testDirs = ['api-test', 'db-test', 'worker-test'];

for (const dir of testDirs) {
  rmSync(join(localDataDir, dir), { recursive: true, force: true });
}
