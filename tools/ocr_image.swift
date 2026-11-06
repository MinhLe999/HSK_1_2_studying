import AppKit
import Foundation
import Vision

// Doc chu Han trong mot tep anh bang Vision cua macOS.
// Chi dung mo hinh chu Han (zh-Hans): pinyin va tieng Viet trong anh bi doc sai,
// va app khong can chung - nghia va so bai lay tu public/content.js.

guard CommandLine.arguments.count >= 2 else {
    fputs("Cach dung: ocr_image <tep-anh>\n", stderr)
    exit(1)
}

let imagePath = CommandLine.arguments[1]

guard
    let image = NSImage(contentsOfFile: imagePath),
    let tiff = image.tiffRepresentation,
    let bitmap = NSBitmapImageRep(data: tiff),
    let cgImage = bitmap.cgImage
else {
    fputs("Khong doc duoc tep anh.\n", stderr)
    exit(2)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.recognitionLanguages = ["zh-Hans"]
request.usesLanguageCorrection = true

do {
    let handler = VNImageRequestHandler(cgImage: cgImage)
    try handler.perform([request])
} catch {
    fputs("Vision khong nhan dang duoc anh: \(error.localizedDescription)\n", stderr)
    exit(3)
}

for observation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else { continue }
    print(candidate.string)
}
