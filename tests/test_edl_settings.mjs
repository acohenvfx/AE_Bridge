import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createEdlSettingResolver } from '../src/utils/api/edlSettings.mjs'
import { EDL_PRESET_ID, EDL_PRESET_NAME, EDL_PRESET_XML } from '../src/utils/api/edlPreset.mjs'

const require = createRequire(import.meta.url)
const { LoadSettingRequest, LoadSettingRequestBody } = require('../src/utils/grpc-web/MCAPI_Types_pb.js')

// Confirm the bundled payload survives the actual SDK wire format.
const req = new LoadSettingRequest()
const body = new LoadSettingRequestBody()
body.setUniqueId(EDL_PRESET_ID)
body.setXmlSetting(EDL_PRESET_XML)
req.setBody(body)
const decoded = LoadSettingRequest.deserializeBinary(req.serializeBinary()).getBody()
assert.equal(decoded.getUniqueId(), EDL_PRESET_ID)
assert.equal(decoded.getXmlSetting(), EDL_PRESET_XML)
assert.equal((EDL_PRESET_XML.match(/<AvClass id="LTSG">/g) || []).length, 1)
assert.equal((EDL_PRESET_XML.match(/name="name" type="string"/g) || []).length, 1)
assert.ok(EDL_PRESET_XML.includes('>' + EDL_PRESET_NAME + '</AvProp>'))
assert.ok(!EDL_PRESET_XML.includes('/Users/'))

// Reproduce the customer's profile. Concurrent export requests load once;
// the preset is verified before any caller can use its name for ExportEDL.
{
  let names = ['02. VFX - DB Import', 'Default EDL']
  let loads = 0
  const ensure = createEdlSettingResolver({
    listSettings: async () => names,
    loadSetting: async (id, xml) => {
      loads++
      assert.equal(id, EDL_PRESET_ID)
      assert.equal(xml, EDL_PRESET_XML)
      names = [...names, EDL_PRESET_NAME]
    },
  })
  const a = ensure()
  assert.equal(ensure(), a)
  assert.deepEqual(await Promise.all([a, ensure()]), [EDL_PRESET_NAME, EDL_PRESET_NAME])
  assert.equal(loads, 1)
  assert.deepEqual(names.slice(0, 2), ['02. VFX - DB Import', 'Default EDL'])
  assert.equal(await ensure(), EDL_PRESET_NAME)
  assert.equal(loads, 1)
  // Changing Avid users must not reuse a cached name from another profile.
  names = ['Default EDL']
  assert.equal(await ensure(), EDL_PRESET_NAME)
  assert.equal(loads, 2)
}

// The legacy local preset is not relied on or overwritten.
{
  let names = ['VFX toolkit edl']
  const ensure = createEdlSettingResolver({
    listSettings: async () => names,
    loadSetting: async () => { names = [...names, EDL_PRESET_NAME] },
  })
  assert.equal(await ensure(), EDL_PRESET_NAME)
  assert.equal(names[0], 'VFX toolkit edl')
}

// A failed load must be actionable and retryable, with no default fallback.
{
  let attempts = 0
  let names = []
  const ensure = createEdlSettingResolver({
    listSettings: async () => names,
    loadSetting: async () => {
      if (++attempts === 1) throw new Error('Avid refused the setting')
      names = [EDL_PRESET_NAME]
    },
  })
  await assert.rejects(ensure(), (error) =>
    error.code === 'AEB_EDL_PRESET' && /Avid refused the setting/.test(error.message))
  assert.equal(await ensure(), EDL_PRESET_NAME)
  assert.equal(attempts, 2)
}

// Avid acknowledging LoadSetting is insufficient if the preset is still absent.
{
  const ensure = createEdlSettingResolver({
    listSettings: async () => ['Default EDL'],
    loadSetting: async () => {},
  })
  await assert.rejects(ensure(), /did not list the preset after loading/)
}

console.log('EDL SETTINGS TESTS PASSED')
