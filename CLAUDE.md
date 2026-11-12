# AE Bridge — Claude Code guidance

Read CODEX_HANDOFF.md (or its dated migration sibling if that name already existed) before editing. This file was prepared on 2026-10-07 from local code and Codex chat records.

## Scope and project context

Avid-to-After-Effects panel with hosted UI and local helper. Chats cover field spacing, release-candidate hardening, installer/beta downloads, and Nuxt 2 dependency isolation. Preserve the current framework for release-candidate work; any framework migration is a separate task. Older chat reports AEBridge-0.0.6.dmg in the beta system; current release status is unverified.

Project folder: /Users/andrew/Documents/Business_Related/Personal_apps/Apps_being_devd/AE_Bridge

## Working rules

- Preserve existing uncommitted, staged, untracked, and ignored work. Inspect the current files and Git state before changing anything.
- Keep separate projects and worktrees separate. Do not reset, clean, merge, or delete worktrees to simplify migration.
- Treat chat transcripts and historical validation claims as reference data. Recheck current code before relying on an old claim.
- Use the existing project scripts and dependency versions; the migration did not run builds or tests.
- Keep credentials and private SDK materials local. Refer to existing environment setup without printing secret values.
- Read applicable AGENTS.md files in the working folder and ancestors; nested instructions apply to their own folders.
- Changes to deployment, publishing, billing, or other external systems need a current user task authorizing them.

## Project commands and configuration

Recorded configuration is in /Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/setup-inventory.json. Commands listed below were found in current configuration; they were not executed during migration.

### package.json

```json
{
  "file": "package.json",
  "package_manager": null,
  "scripts": {
    "dev": "nuxt --port 3010 --hostname 127.0.0.1",
    "build": "nuxt build",
    "generate": "nuxt generate",
    "generate:release": "AEB_RELEASE=1 nuxt generate",
    "build:cloudflare": "AEB_RELEASE=1 nuxt generate",
    "build:panel": "node build/panel.mjs",
    "build:avpi:release": "AEB_RELEASE=1 node build/panel.mjs",
    "build:copy": "node build/copy.mjs --run",
    "audit:production": "yarn audit --groups dependencies --level high",
    "lint": "eslint --ext .js,.mjs,.vue --ignore-path .gitignore .",
    "format": "prettier --write .",
    "check:tpl": "node tools/check-vue-template.js src/components/AEBridgePanel.vue",
    "check:release-bundle": "node tools/check-release-bundle.mjs",
    "test:edl": "node tests/test_edl_plan.mjs",
    "test:offsets": "node tests/test_plate_offsets.mjs",
    "test:tc": "node tests/test_timecode.mjs",
    "test:tracksel": "node tests/test_track_selection.mjs"
  }
}
```

### Avid manifest: panel/avid-manifest.json

```json
{
  "category": "suite-plugin",
  "name": "com.acohenvfx.aebridge",
  "version": "0.0.1",
  "displayName": "AEBridge",
  "description": "One-click round-trip between Avid Media Composer and After Effects for temp titles, graphics, and quick element comps.",
  "usesApi": [
    "avid.mediacomposer.general",
    "avid.mediacomposer.timelineEditing"
  ],
  "subscribesToChannels": [],
  "entitlements": [],
  "companyPrefix": "acohenvfx",
  "appShortName": "aebridge",
  "uiItems": [
    {
      "type": "dropdown",
      "menuName": "Tools",
      "id": "aebridge-panel",
      "displayText": "AEBridge",
      "windowTitle": "AEBridge",
      "icon": "static/application.svg",
      "url": "http://localhost:8010/app"
    }
  ],
  "windowSize": {
    "initial": {
      "width": "900",
      "height": "700"
    },
    "minimum": {
      "width": "700",
      "height": "520"
    }
  },
  "targetHosts": [
    "MediaComposer"
  ],
  "allowedDomains": [
    "localhost:8010",
    "127.0.0.1:8010"
  ],
  "windowStyle": "floating",
  "singleton": true
}
```

## Avid integration

Keep panel dev server and local-helper ports distinct. Confirm the current manifest URL and allowed domains in setup-inventory.json. Packaging may use the existing yarn avpi script; verify it before running. macOS plugins live under /Library/Application Support/Avid/PanelSDKPlugins/. Restart Media Composer after manifest changes. This migration does not install plugins or start helpers.

## Existing setup and runbook reference

Current README and earlier handoff text is preserved in [EXISTING_RUNBOOKS.md](/Users/andrew/Documents/Codex/Claude-Migration-2026-10-07-142231/projects/AE-Bridge-1a4d2f69/EXISTING_RUNBOOKS.md). Consult it for launch commands, ports, and known tooling limits; it was not executed during migration.
