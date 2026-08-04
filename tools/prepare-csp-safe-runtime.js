const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const files = [
  'node_modules/core-js/modules/_global.js',
  'node_modules/core-js/library/modules/_global.js',
  'node_modules/webpack/buildin/global.js',
  'node_modules/google-protobuf/google/protobuf/any_pb.js',
  'node_modules/google-protobuf/google/protobuf/api_pb.js',
  'node_modules/google-protobuf/google/protobuf/compiler/plugin_pb.js',
  'node_modules/google-protobuf/google/protobuf/descriptor_pb.js',
  'node_modules/google-protobuf/google/protobuf/duration_pb.js',
  'node_modules/google-protobuf/google/protobuf/empty_pb.js',
  'node_modules/google-protobuf/google/protobuf/field_mask_pb.js',
  'node_modules/google-protobuf/google/protobuf/source_context_pb.js',
  'node_modules/google-protobuf/google/protobuf/struct_pb.js',
  'node_modules/google-protobuf/google/protobuf/timestamp_pb.js',
  'node_modules/google-protobuf/google/protobuf/type_pb.js',
  'node_modules/google-protobuf/google/protobuf/wrappers_pb.js'
]

let changed = 0
for (const relative of files) {
  const file = path.join(root, relative)
  if (!fs.existsSync(file)) continue

  const source = fs.readFileSync(file, 'utf8')
  const safe = source.replace(/(?:new )?Function\((['"])return this\1\)\(\)/g, 'globalThis')
  if (safe === source) continue

  fs.writeFileSync(file, safe)
  changed += 1
}

console.log(`Prepared CSP-safe runtime fallbacks in ${changed} dependency file${changed === 1 ? '' : 's'}.`)
