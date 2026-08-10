import assert from 'node:assert/strict'

import {
  narrowToSelection,
  lowestTrack,
} from '../src/utils/api/trackSelection.mjs'

const track = (number, selected = false) => ({
  number,
  selected,
  type: 1,
  enabled: false,
  numSegments: 1,
})

{
  // Nothing selected: every track with content is kept, unchanged order —
  // this is the existing behavior for an editor who has never used selection.
  const all = [track(1), track(2), track(3)]
  assert.deepEqual(narrowToSelection(all), all)
}

{
  // The reported case: 20 video tracks, only V14-16 selected.
  const all = [
    track(1),
    track(2),
    track(14, true),
    track(15, true),
    track(16, true),
    track(20),
  ]
  const narrowed = narrowToSelection(all)
  assert.deepEqual(
    narrowed.map((t) => t.number),
    [14, 15, 16]
  )
}

{
  // A single selected track still narrows to just itself.
  const all = [track(1), track(2, true), track(3)]
  assert.deepEqual(
    narrowToSelection(all).map((t) => t.number),
    [2]
  )
}

{
  // Selection order in the input must not matter — the result is whatever
  // was selected, not reordered or deduped beyond that.
  const all = [track(9, true), track(1), track(5, true)]
  assert.deepEqual(
    narrowToSelection(all).map((t) => t.number),
    [9, 5]
  )
}

{
  // Empty input.
  assert.deepEqual(narrowToSelection([]), [])
  assert.deepEqual(narrowToSelection(null), [])
}

{
  // lowestTrack: the anchor is whichever track NUMBER is lowest, regardless
  // of array order.
  assert.equal(lowestTrack([track(14), track(15), track(16)]).number, 14)
  assert.equal(lowestTrack([track(15), track(14), track(16)]).number, 14)
  assert.equal(lowestTrack([track(3)]).number, 3)
  assert.equal(lowestTrack([]), null)
  assert.equal(lowestTrack(null), null)
}

{
  // The composed real-world flow: narrow to V14-16, then find the anchor.
  const all = [
    track(1),
    track(2),
    track(14, true),
    track(15, true),
    track(16, true),
  ]
  const anchor = lowestTrack(narrowToSelection(all))
  assert.equal(anchor.number, 14)
}

console.log('trackSelection: all assertions passed')
