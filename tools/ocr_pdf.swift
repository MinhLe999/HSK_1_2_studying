import AppKit
import Foundation
import PDFKit
import Vision

guard CommandLine.arguments.count >= 4 else {
    fputs("Cach dung: ocr_pdf <tep-pdf> <trang-dau> <trang-cuoi>\n", stderr)
    exit(1)
}

let pdfPath = CommandLine.arguments[1]
let firstPage = max(1, Int(CommandLine.arguments[2]) ?? 1)
let requestedLastPage = max(firstPage, Int(CommandLine.arguments[3]) ?? firstPage)

guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    fputs("Khong the mo tep PDF.\n", stderr)
    exit(1)
}

let lastPage = min(document.pageCount, requestedLastPage)
let renderWidth: CGFloat = 2200

for pageNumber in firstPage...lastPage {
    guard let page = document.page(at: pageNumber - 1) else { continue }
    let bounds = page.bounds(for: .mediaBox)
    let scale = renderWidth / bounds.width
    let size = NSSize(width: renderWidth, height: bounds.height * scale)
    let image = page.thumbnail(of: size, for: .mediaBox)

    guard
        let tiff = image.tiffRepresentation,
        let bitmap = NSBitmapImageRep(data: tiff),
        let cgImage = bitmap.cgImage
    else {
        continue
    }

    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.recognitionLanguages = ["zh-Hans", "vi-VN"]
    request.usesLanguageCorrection = true

    let handler = VNImageRequestHandler(cgImage: cgImage)
    try handler.perform([request])

    print("\n===== TRANG \(pageNumber) =====\n")
    let observations = request.results ?? []
    for observation in observations {
        if let text = observation.topCandidates(1).first?.string {
            print(text)
        }
    }
}
