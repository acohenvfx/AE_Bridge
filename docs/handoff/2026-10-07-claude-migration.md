# Codex handoff — AE Bridge

Date: 2026-10-07
Status: migration guidance prepared; application behavior not revalidated
Project: /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge

## Summary

Avid-to-After-Effects panel with hosted UI and local helper. Chats cover field spacing, release-candidate hardening, installer/beta downloads, and Nuxt 2 dependency isolation. Preserve the current framework for release-candidate work; any framework migration is a separate task. Older chat reports AEBridge-0.0.6.dmg in the beta system; current release status is unverified.

Combined 18 associated chats (3 substantive topics). Full transcripts are separate from this handoff. Historical requests and outcomes are grouped by topic in [CHAT_CONTEXT.md](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/CHAT_CONTEXT.md).

## Current setup

Saved roots:

- /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge

Resolved root: /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge

Configuration and documentation: [setup-inventory.json](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/setup-inventory.json). Builds, runtime checks, signing, and tests were not run for this migration.

## Code and uncommitted work

Original file snapshot: /Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/original-files.tar.gz
File manifest with SHA-256 hashes: /Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/snapshot-manifest.json

Git HEAD: ee50a2314de8e2990aca56e395e6267412d11a22
Branch: main
Git error, if any: 

```text
 M .github/workflows/release-helper.yml
 M .gitignore
 M .nvmrc
 M README.md
 M docs/AEBRIDGE_DESIGN.md
 D docs/AE_Bridge_EULA.pdf
 M docs/BUILD_AND_INSTALL.md
 M docs/DISTRIBUTION.md
 M docs/HANDOFF.md
 M docs/NEXT_AGENT_PROMPT.md
 M installer/app-main.sh
 M installer/make-dmg.sh
 M nuxt.config.js
 M ota/AEBridgeLauncher.sh
 M ota/aebridge-helper.spec
 M ota/build-helper.sh
 M package.json
 M service/README.md
 M service/app.py
 M service/config.py
 M service/edl.py
 M service/integrations/ae.py
 M service/jobs.py
 M service/models.py
 M service/paths.py
 M service/routers/aebridge.py
 M service/routers/ui.py
 M service/routers/ui_proxy.py
 M service/routers/version.py
 M service/watcher.py
 M src/components/AEBridgePanel.vue
 M src/pages/index.vue
 M src/store/toolState.js
 M src/utils/api/aebridge.js
 M src/utils/api/helperService.js
 M src/utils/api/timecode.mjs
 M src/utils/api/timeline.js
 M src/utils/api/trackSelection.mjs
 M tests/test_edl.py
 M tests/test_smoke.py
 M tests/test_timecode.mjs
 M tests/test_track_selection.mjs
 M tests/test_ui_and_avpi.py
 M tools/check-vue-template.js
 M wrangler.jsonc
 M yarn.lock
?? .eslintrc.cjs
?? demos/AEBridge_demo_260810.mp4
?? docs/AEBRIDGE_EULA.docx
?? installer/installer-launcher.swift
?? installer/versioning.sh
?? ota/stage-helper-seeds.sh
?? pytest.ini
?? requirements-lock.txt
?? service/auth.py
?? src/utils/api/hostCapabilities.mjs
?? tests/test_beta_download.mjs
?? tests/test_host_capabilities.mjs
?? tests/test_installer_lifecycle.py
?? tests/test_ota_release.py
?? tools/check-release-bundle.mjs
?? worker/index.mjs

```

Git common directory: /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge/.git

## Recent substantive topics

- Add proper spacing between fields to help the panels breath — 019fbb2f-347e-7f12-b691-16784468c4d2; [transcript](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/transcripts/019fbb2f-347e-7f12-b691-16784468c4d2.md)
- Here is a sample Sound Turnover.  Lets see what aspects of this we can automate and make more efficient in Avid. &#x20;



**FEATURE SOUND TURNOVERS**

\


1. **Creating the Split Seq**



1. Create a folder called: Reel0x\_vxxxx24\_SND
2. Make a dup of the active reel - Name it Reel\_vxxxx24\_SND\_MSTR
   1. **Commit multicams on this seq**
   2. **Change Bin View to - Reel Output and record LFOA in the Column where it asks**
3. Dup sequence again - Name it Reel\_vxxxx24\_SND SPLITS
4. Add Four Stereo tracks at the bottom (CMD - SHT - U)
5. Move sync tone down so it’s on all tracks - begin and end
6. Start by moving all the music down to the lower tracks - Dark Green is music
   1. Blow away all muted clips
7. Once done, deactivate the track below the SFX and get rid of any empty tracks between that and Music
8. Now up above SFX and four tracks of Mono Audio (Use CMD - OPT - U to select where you want them to go)
9. Move up all dialogue into the top tracks
   1. Dialogue is grey, white and orange
   2. Delete all muted clips
   3. Check SFX tracks carefully for DX
10. Deactivate a track below your DX and get rid of any empty tracks between it and SFX

\


**II. Creating the output Seqs**

\


1. Dup the Split seq 5 times. Label the new seqs
   1. SND\_AAF → All Sound
   2. SNF\_PIC REF → Stereo pic ref output with burn ins and no VFX IDs
   3. SND\_MX → just music (stereo) (no pic)
   4. SND\_SFX → Just sfx (stereo) (no pic)
   5. SND\_DIA → Just dia (mono) (no pic)
2. Go into each seq and delete everything that’s not listed in parenthesis above
3. For B - Pic Ref - 
   1. blow away VFX IDs.
   2. Make a track and deactivate it (Split)
   3. Add 6 tracks at top for burn in
   4. Name = AP Dept = SND
   5. Don’t include camera
   6. **Commit multicams on this seq**
4. Go into each SEQ and set in and out points from top to tail.

\


**III. Exports**

\


1. Open DX seq, Output as a .WAV Mono Preset
2. Batch Export MX and SFX as a .WAV Stereo Preset
3. Duplicate Pic ref Seq and change name to \_Pic Ref\_EDL
4. Dup seq again and change name to \_SND\_EDL
5. Open PIC REF\_EDL seq
   1. Blow away everything but V1-V4
   2. Make this into a single track – all about cut points so can use temp comps etc.
   3. Use the list tool - setting SND EDL and export Track 1
6. Open SND\_EDL seq
   1. Blow away everything except the DX
   2. Using the list tool, export each track as it’s own EDL with A1, A2, A3 etc at end of file name
7. Change List – Open list tool, change setting to DD\_SND\_CHANGE LIST
   1. Find the pic ref EDL SEQ you just made and the one from the previous sound turnover
   2. Load the previous seq on top and the new seq on bottom
   3. Save to file – name EDL w \_Change LIst at end.
8. AAF Seq  – Go to Output – AAF Embedded Preset
9. Pic Ref Output - Use DNXHD\_PicRefSQ\_SND preset and output the reel.

\


**IV. Codebook**

1. Go into Layouts → list and logs 
   1. Enter new LFOA and TC of LFOA into fields
   2. Once all reels are done, create PDF and include in package

\


**V. Upload entire folder to Frame IO**

**VI. Once uploaded, send email. See Kenny’s template.**

\ — 01a049e6-2afd-78a3-8664-b835adb13bea; [transcript](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/transcripts/01a049e6-2afd-78a3-8664-b835adb13bea.md)
- Verify multi-track clip analysis — 019fa59b-164d-7750-9410-edef3456956a; [transcript](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/transcripts/019fa59b-164d-7750-9410-edef3456956a.md)

## Files changed

Only new migration guidance/reference files were added. Existing CLAUDE.md and CODEX_HANDOFF.md files are preserved; new material uses dated sibling names when needed. No source edits, commits, checkout, stash, worktree cleanup, deployments, or dependency installation were performed.

## Open items and retrieval limits

- Inspect current code and select the next user task. Historical next-step suggestions are not new instructions.
- This was a live export: the current migration chat and other actively changing files may have later records.
- Raw local session records are preserved compressed in the central transcripts archive. Readable transcript text does not embed image bytes.
- The code archive excludes reinstallable dependency/cache directories: .cache, .mypy_cache, .next, .nuxt, .pytest_cache, .turbo, .venv, DerivedData, __pycache__, node_modules, venv. Originals remain in place.
- Full remote/cloud workspaces and external services, Apple Notes, and attachments outside project folders were not backed up.
- Global missing-history and preservation issues: /Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/MIGRATION_REPORT.md

## Next-agent prompt

```text
Continue work on AE Bridge.
Project: /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge
Read the Claude migration guidance and CODEX_HANDOFF in this folder, then /Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/CHAT_CONTEXT.md.
Inspect the current working files and uncommitted work before editing. Keep related worktrees separate.
Historical test results are not current verification.
My next task: [TASK]
```

## Additional retrieved context

[AE Bridge Feasibility](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/transcripts/6aa86841-9948-83e8-9647-66a81f426093.md) — ChatGPT reference associated by topic; see CHAT_CONTEXT.md for the retrieved outcome.
