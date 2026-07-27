// Runs manifest.mjs then zip.mjs — the one-shot panel build.
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const node = process.execPath

for (const step of ['manifest.mjs', 'zip.mjs']) {
  execFileSync(node, [resolve(__dirname, step)], { stdio: 'inherit', env: process.env })
}
