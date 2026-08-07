#!/usr/bin/osascript -l JavaScript

// Small native Cocoa progress window used by the shell-based installer.
// The installer writes `percent|message` to the supplied status file and
// writes DONE when it is safe for this window to close.
//
// Ported from DifferenceEngine's installer/install-progress.js. Kept byte-for-
// byte in structure so a fix in one can be carried to the others; only the
// product name differs.
ObjC.import('Cocoa')

const args = $.NSProcessInfo.processInfo.arguments
const statusPath = ObjC.unwrap(args.lastObject)
const app = $.NSApplication.sharedApplication
app.setActivationPolicy($.NSApplicationActivationPolicyAccessory)

const style = $.NSWindowStyleMaskTitled
const window = $.NSWindow.alloc.initWithContentRectStyleMaskBackingDefer(
  $.NSMakeRect(0, 0, 420, 138),
  style,
  $.NSBackingStoreBuffered,
  false,
)
window.setTitle($('Installing AEBridge'))
window.setReleasedWhenClosed(false)
window.center

const content = window.contentView
const title = $.NSTextField.labelWithString($('Installing AEBridge'))
title.setFont($.NSFont.boldSystemFontOfSize(16))
title.setFrame($.NSMakeRect(24, 91, 372, 24))
content.addSubview(title)

const message = $.NSTextField.labelWithString($('Preparing installation…'))
message.setFrame($.NSMakeRect(24, 62, 372, 20))
content.addSubview(message)

const progress = $.NSProgressIndicator.alloc.initWithFrame($.NSMakeRect(24, 32, 372, 16))
progress.setIndeterminate(false)
progress.setMinValue(0)
progress.setMaxValue(100)
progress.setDoubleValue(0)
content.addSubview(progress)

window.makeKeyAndOrderFront(null)
app.activateIgnoringOtherApps(true)

function readStatus() {
  if (!$.NSFileManager.defaultManager.fileExistsAtPath($(statusPath))) return ''
  const data = $.NSData.dataWithContentsOfFile($(statusPath))
  if (!data) return ''
  return ObjC.unwrap($.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding)).trim()
}

while (true) {
  const status = readStatus()
  if (status === 'DONE') break

  const separator = status.indexOf('|')
  if (separator > 0) {
    const percent = Number(status.slice(0, separator))
    const detail = status.slice(separator + 1)
    if (Number.isFinite(percent)) progress.setDoubleValue(percent)
    if (detail) message.setStringValue($(detail))
  }

  $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.15))
}

window.orderOut(null)
