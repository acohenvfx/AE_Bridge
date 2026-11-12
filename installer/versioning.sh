#!/usr/bin/env bash

# Convert the human-facing release version into Apple's numeric bundle build
# version. Marketing versions may carry an RC suffix; CFBundleVersion may not.
aebridge_bundle_version() {
  local marketing="${1#v}" override="${2:-}"
  if [[ -n "$override" ]]; then
    [[ "$override" =~ ^[0-9]+(\.[0-9]+){0,3}$ ]] || return 1
    printf '%s\n' "$override"
    return 0
  fi
  if [[ "$marketing" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)$ ]]; then
    printf '%s.%s.%s\n' "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}"
    return 0
  fi
  if [[ "$marketing" =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)-rc\.([0-9]+)$ ]]; then
    printf '%s.%s.%s.%s\n' \
      "${BASH_REMATCH[1]}" "${BASH_REMATCH[2]}" "${BASH_REMATCH[3]}" "${BASH_REMATCH[4]}"
    return 0
  fi
  return 1
}
