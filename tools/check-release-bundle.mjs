import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.argv[2] || 'dist/html')
const required = ['index.html', path.join('app', 'index.html')]
const textExtensions = new Set(['.css', '.html', '.js', '.json', '.txt', '.xml'])
const forbiddenFiles = [/\.map$/i, /\.(?:pem|key|p12|pfx)$/i]
const forbiddenText = [
  { label: 'developer home path', pattern: /\/Users\// },
  { label: 'local file URL', pattern: /file:\/\//i },
  { label: 'development panel origin', pattern: /(?:localhost|127\.0\.0\.1):3010/i },
  { label: 'signing secret name', pattern: /MAC_(?:CERT|DEVELOPER|NOTARY)/ },
  { label: 'update secret name', pattern: /AEBRIDGE_UPDATE_TOKEN/ },
  { label: 'private key material', pattern: /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/ }
]

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  throw new Error(`Release bundle not found: ${root}`)
}

for (const relative of required) {
  if (!fs.existsSync(path.join(root, relative))) {
    throw new Error(`Release bundle is missing ${relative}`)
  }
}

const files = []
const visit = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    const relative = path.relative(root, absolute)
    const stat = fs.lstatSync(absolute)
    if (stat.isSymbolicLink()) throw new Error(`Release bundle contains symlink: ${relative}`)
    if (stat.isDirectory()) visit(absolute)
    else if (stat.isFile()) files.push({ absolute, relative, size: stat.size })
  }
}
visit(root)

for (const file of files) {
  if (forbiddenFiles.some((pattern) => pattern.test(file.relative))) {
    throw new Error(`Forbidden release artifact: ${file.relative}`)
  }
  if (!textExtensions.has(path.extname(file.relative).toLowerCase())) continue
  const contents = fs.readFileSync(file.absolute, 'utf8')
  for (const check of forbiddenText) {
    if (check.pattern.test(contents)) {
      throw new Error(`${check.label} found in ${file.relative}`)
    }
  }
}

const totalBytes = files.reduce((total, file) => total + file.size, 0)
console.log(`release bundle: ${files.length} files, ${totalBytes} bytes, checks passed`)
