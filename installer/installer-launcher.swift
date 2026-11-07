import AppKit
import Foundation

/// Keeps the shell installer attached to a normal foreground macOS app.
/// This gives the installer a Dock icon and a Cmd-Tab entry while its dialogs
/// and progress UI are running.
final class InstallerDelegate: NSObject, NSApplicationDelegate {
    private var child: Process?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)

        guard let script = Bundle.main.url(forResource: "installer-main", withExtension: "sh") else {
            exit(1)
        }

        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/bin/bash")
        process.arguments = [script.path]
        process.currentDirectoryURL = Bundle.main.bundleURL
        process.terminationHandler = { child in
            DispatchQueue.main.async {
                exit(child.terminationStatus)
            }
        }
        child = process

        do {
            try process.run()
        } catch {
            exit(1)
        }
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        child?.terminate()
        return .terminateNow
    }
}

let app = NSApplication.shared
let delegate = InstallerDelegate()
app.delegate = delegate
app.run()
