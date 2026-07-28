# Phase: Multi-plate / multi-track

> **2026-07-28 status — the one-call plate stack is REFUTED in Avid.**
> There is no per-track fan: with V1+V2 enabled, `CreateSubClip` +
> `enabled_tracks_only` returns ONE subclip of the **composite**, labelled `V1`,
> and exporting it gives V2's picture. The `Tracks` column cannot be trusted.
> See the corrected fact in `HANDOFF.md`. All mechanics below that assume
> `CreateSubClip(track_list=…)` or a per-track fan are **obsolete**.
>
> - **Vertical (stack at the playhead)** — BUILT as a **guided multi-pass grab**
>   (UI `.9`, pending Avid verification). Only the enable state isolates, and it
>   isolates one track per grab, so the panel enumerates the stack
>   (`analyzeStack`), then walks the user one track per pass ("enable only V2 →
>   Grab V2"), refusing any grab that would flatten. Send ships the collected
>   `plates[]` and AE builds the layered comp. Note the panel can READ track
>   enable state (`getMobTrackInfo`) but cannot set it — hence the manual step.
> - **Horizontal (marked range → one temp per V1 clip)** — NOT built; the
>   marked-range derivation below must be rebuilt on the playhead-based
>   pipeline and verified in Avid.

## Goal

A VFX temp shot often isn't a single flat image, and a marked range often spans
several cuts. This phase splits a marked range into **one temp per V1 clip**,
each temp being a **vertical stack of plates** (the V1 clip + the clips above it
on the enabled tracks), and builds **one AE comp per V1 clip** with those plates
as layers.

## Model (locked)

- The marked IN/OUT range can cover **multiple V1 clips** (cuts on the bottom
  track). **Each V1 clip = one temp = one AE comp = one job.** A range over two
  V1 clips produces two comps / two renders / two returns.
- The **marker on each V1 clip** (its comment) is the **base name** for that
  temp.
- Within a temp, each **enabled track** contributes one plate over the V1 clip's
  time span:
  - V1 = `<marker>` (base)
  - V2 above it = `<marker>_pl02`
  - V3 above it = `<marker>_pl03` … by track height.
- **Every clip is its own subclip → its own opaque plate** (DNx36; no alpha).
- Plate names are **editable per track** before sending (override `_plNN`).
- Per V1 clip, the AE comp stacks its plates as layers (V1 bottom → Vn top);
  opaque, so the artist toggles/blends/masks as needed.

## The hard part: enumerating clips

MCAPI exposes only `num_segments` per track — **not** per-clip boundaries. The
workable path:

1. **`ExportEDL(recordSeq, track_list=[V1])`** → an EDL file → parse events to
   get each **V1 clip's record in/out** (filter to the marked range by TC).
2. For each V1 clip span, and for each **enabled** video track,
   **`CreateSubClip(head_timecode=in−handles, end_timecode=out+handles,
   track_list=[track], create_new_sequence=true)`** → one subclip per track per
   group. (Explicit TC bounds instead of `use_marks_bounds`, so we can target
   each V1 clip's span precisely.)
3. **`GetMarkers`** on the record sequence → the marker whose offset falls in a
   V1 clip's span gives that group's base name.
4. Recover each new subclip via the bin diff (as today); rename per the `_plNN`
   convention; export each into that job's `PLATE/`.
5. Build **one comp per group** from its `plates[]`; queue each to render into
   its own `RENDER/`.

## Job model change

One **Send** fans out to **N jobs** (one per V1 clip). Each job is the existing
single-shot pipeline (folder `<date>_<marker>`, PLATE/RENDER, comp, watcher,
import) — just created N times. The panel shows N job rows; each returns and
imports independently.

## Helper / contract changes

- `SendRequest` becomes a **batch**: a list of jobs, each with its `shot` +
  `plates: [{ track, name, file, order }]`.
- `prepare` is called per job (per V1 clip) to make its `<date>_<name>` folder.
- `prepare_comp` takes `plates[]` and builds a layered comp (bottom→top).
- Sidecar per job gains `plates[]`.
- Watcher / return / import: unchanged, just per job.

## Panel UX

- After grabbing, show a **plan preview**: the list of temps (V1 clips) and, per
  temp, the plate stack with **editable names** (default `_plNN`), before the
  batch Send.
- Per-plate / per-job progress and job rows.

## Marks are not readable (confirmed) → how we filter to the range

MCAPI does **not** expose the sequence mark IN/OUT in record TC (`GetValues` is
test-only; no marks key), and `ExportEDL` ignores marks — it dumps the whole
track. So to limit enumeration to the marked range we derive it indirectly:

1. `CreateSubClip(use_marks_bounds, create_new_sequence=false, track_list=[V1])`
   — MC applies the marks internally and makes a subclip **per V1 clip in the
   marked range**. Read their `Name` + source in/out → the *set* of marked V1
   clips.
2. Match that set to the V1 EDL events (by clip name + source TC) → their
   **record** spans → the marked record range.
3. Filter every track's EDL to that record range; group by V1 clip.

Trade-off: step 1 creates scratch subclips (put them in a dedicated scratch bin,
clean up after). Name matching needs a source-TC tiebreaker for duplicate names.

Status: superseded by the playhead pivot — the 4a "Analyze" table and
`getMarkedTrackClips`/`deriveMarkedRange` were removed with the sequence-grab
path. Marked-range (horizontal) batching will need this derivation rebuilt on
the current playhead-based pipeline.

## Unknowns to verify in Avid (4a)

1. **EDL enumeration** — does `ExportEDL(track_list=[V1])` reliably list each V1
   clip with usable record in/out? Does it honor marks or export the whole track
   (then we filter by TC)? Parse format (CMX3600) via EB `edl.js` patterns.
2. **Per-track/per-range subclip** — `CreateSubClip(head_timecode/end_timecode,
   track_list=[track])` cleanly isolates one track's image over an arbitrary
   record span?
3. **Marker → V1 clip mapping** — marker offset vs. clip record range.
4. **DNxHD wrapper** — export setting must be **QuickTime-wrapped** DNxHD 36
   (`.mov`) so AE imports it (OP-Atom MXF may not).

## Phasing

- **4a — Enumerate + isolate (proof):** EDL-parse V1 clips in the range; for a
  V1+V2 shot with 2 cuts, produce the correct per-track/per-group subclips and
  export opaque plates named by the `_plNN` convention. No comp/panel changes.
- **4b — Per-group comps:** `prepare_comp` builds the layered comp from
  `plates[]`; one job per V1 clip end to end (export → AE → render → return).
- **4c — Panel plan preview + editable plate names + batch Send + N job rows.**
- **4d — Polish:** empty-track handling, naming edge cases, marker-per-clip
  fallbacks.

## Decisions (locked)

- **Split per V1 clip:** yes — each V1 clip in the range is its own temp/comp/job.
- **Grouping/comp:** one comp per V1 clip, plates stacked as layers.
- **Naming:** V1 = base marker name; tracks above = `<base>_pl02`, `_pl03` …;
  editable per track.
- **Track selection:** enabled/selected tracks only.
- **Codec:** one export setting for all, all opaque (typ. DNx36), QuickTime
  wrapper.
- **No alpha, no per-track codec logic.**
