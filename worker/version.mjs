// The release version, read from package.json so the Worker can't drift from
// it. Kept in its own module because ESLint 8 (espree) can't parse import
// attributes; .eslintrc.cjs ignores just this file. Wrangler (esbuild) and
// Node 22 both understand the syntax.
import pkg from '../package.json' with { type: 'json' }

export const VERSION = pkg.version
