import Foundation
import PDFKit

guard CommandLine.arguments.count >= 2 else {
    fputs("Cach dung: extract_pdf <tep-pdf> [trang-dau] [trang-cuoi]\n", stderr)
    exit(1)
}

let pdfPath = CommandLine.arguments[1]
guard let document = PDFDocument(url: URL(fileURLWithPath: pdfPath)) else {
    fputs("Khong the mo tep PDF.\n", stderr)
    exit(1)
}

let firstPage = max(1, Int(CommandLine.arguments.dropFirst(2).first ?? "1") ?? 1)
let lastPage = min(
    document.pageCount,
    Int(CommandLine.arguments.dropFirst(3).first ?? "\(document.pageCount)") ?? document.pageCount
)

print("So trang: \(document.pageCount)")
for pageNumber in firstPage...lastPage {
    print("\n===== TRANG \(pageNumber) =====\n")
    print(document.page(at: pageNumber - 1)?.string ?? "")
}
