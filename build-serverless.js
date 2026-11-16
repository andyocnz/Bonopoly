import { build } from 'esbuild'

build({
  entryPoints: ['src/server/serverless-entry.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  outfile: 'api/index.js',
  format: 'esm',
  external: [
    '@prisma/client',
    '.prisma/client',
  ],
  banner: {
    js: `import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);`,
  },
}).catch(() => process.exit(1))
