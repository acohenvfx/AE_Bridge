// aebridge-probe — read a movie's video-stream metadata via AVFoundation.
//
// Replaces the ffprobe dependency for return validation. Emits the same four
// fields service/media.py already consumed from ffprobe, as JSON on stdout:
//
//     {"width":1920,"height":1080,"frame_rate":23.976025,
//      "frame_rate_raw":"24000/1001","frame_count":427}
//
// Why not ffprobe: shipping it means redistributing FFmpeg. The readily
// available macOS builds are GPL and dynamically linked (a Homebrew ffprobe
// breaks on any machine without /opt/homebrew), so bundling one carries both a
// licensing obligation and a portability problem. AVFoundation is part of
// macOS, so this binary is a few hundred KB, trivially universal2, and signs
// and notarizes with the rest of the helper.
//
// It is also faster: the ffprobe call used -count_frames, which DECODES every
// frame of the render just to count them. Sample-reference reading below walks
// the container's sample table without decoding.
//
// Exit codes: 0 ok, 1 usage, 2 unreadable/no video track.
import AVFoundation
import Foundation

func fail(_ message: String, _ code: Int32) -> Never {
    FileHandle.standardError.write(Data((message + "\n").utf8))
    exit(code)
}

// Report NTSC-family rates as the rationals ffprobe used, so operator-facing
// validation messages read the way they always have.
func rateRaw(_ fps: Double) -> String {
    let rationals: [(Double, String)] = [
        (24000.0 / 1001.0, "24000/1001"),
        (30000.0 / 1001.0, "30000/1001"),
        (60000.0 / 1001.0, "60000/1001"),
        (120000.0 / 1001.0, "120000/1001"),
    ]
    for (value, label) in rationals where abs(fps - value) < 0.001 {
        return label
    }
    if abs(fps.rounded() - fps) < 0.001 {
        return "\(Int(fps.rounded()))/1"
    }
    return String(format: "%.6f", fps)
}

// Frame count from the track's PRESENTED duration and its nominal rate.
//
// Do not count stored samples instead. A QuickTime edit list ('elst') can
// present fewer frames than the container holds — an Avid-exported plate here
// stores 1071 samples but presents 1067, which is what ffprobe reports — and
// AVAssetReaderSampleReferenceOutput walks the sample table, so it counts the
// stored 1071 even when constrained to the track's timeRange. Since validation
// compares frame counts for EXACT equality, that would fail good renders.
// track.timeRange is edit-list aware, so duration x rate matches ffprobe.
//
// Returns nil when the rate or duration is unusable: media.py treats a missing
// count as "not checked", which is safer than publishing a wrong one.
func presentedFrameCount(track: AVAssetTrack, fps: Double) -> Int? {
    guard fps > 0 else { return nil }
    let seconds = CMTimeGetSeconds(track.timeRange.duration)
    guard seconds.isFinite, seconds > 0 else { return nil }
    return Int((seconds * fps).rounded())
}

let args = CommandLine.arguments
guard args.count == 2 else {
    fail("usage: aebridge-probe <movie-path>", 1)
}

let url = URL(fileURLWithPath: args[1])
guard FileManager.default.fileExists(atPath: url.path) else {
    fail("file not found: \(url.path)", 2)
}

let asset = AVURLAsset(url: url)
guard let track = asset.tracks(withMediaType: .video).first else {
    fail("no video track in \(url.path)", 2)
}

// naturalSize is pre-rotation; apply the transform so a rotated clip reports
// the dimensions a viewer (and Avid) would see, matching ffprobe.
let size = track.naturalSize.applying(track.preferredTransform)
let width = Int(abs(size.width).rounded())
let height = Int(abs(size.height).rounded())

let fps = Double(track.nominalFrameRate)
let frameCount = presentedFrameCount(track: track, fps: fps)

var payload: [String: Any] = [
    "width": width,
    "height": height,
    "frame_rate": fps,
    "frame_rate_raw": rateRaw(fps),
]
// Omitted rather than zeroed when genuinely unknown: media.py treats a missing
// count as "not checked", while 0 would read as a real mismatch.
if let frameCount { payload["frame_count"] = frameCount }

guard let data = try? JSONSerialization.data(withJSONObject: payload, options: [.sortedKeys]) else {
    fail("could not serialise probe result", 2)
}
FileHandle.standardOutput.write(data)
FileHandle.standardOutput.write(Data("\n".utf8))
