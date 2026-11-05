# Webapp ôn HSK

## Cách chạy

Yêu cầu Node.js 18 trở lên. Tại thư mục dự án, chạy:

```bash
npm start
```

Sau đó mở `http://127.0.0.1:4173`.

Không cần cài gói phụ và không cần kết nối dịch vụ bên ngoài.

## Dữ liệu được lưu

- Tiến độ bài tập, đáp án lượng từ và các cụm chữ tự thêm được lưu tại `data/user-data.json`.
- `materials/HSK.pdf` là tài liệu nguồn 131 trang (server phục vụ tại route `/HSK.pdf`). Thư mục `materials/` không nằm trong Git.
- Muốn dùng cổng khác, chạy ví dụ `PORT=5000 npm start`.
- Máy chủ mặc định chỉ nhận kết nối từ chính máy đang chạy chương trình.
- Muốn truy cập từ máy khác trong cùng mạng LAN, chạy `HOST=0.0.0.0 npm start`, sau đó ở máy kia mở `http://<địa-chỉ-IP-LAN-của-máy-chủ>:4173` (xem địa chỉ bằng `ipconfig getifaddr en0` trên máy Mac chạy máy chủ). Lưu ý: khi mở theo cách này, bất kỳ ai trong cùng mạng LAN cũng đọc/ghi được tiến độ, nên chỉ dùng trên mạng gia đình tin cậy; macOS có thể hỏi cho phép Node nhận kết nối đến, chọn "Allow".

## Cấu trúc

- `server.js`: mở trang web, đọc và ghi dữ liệu, phục vụ từng đoạn của PDF.
- `public/content.js`: từ vựng, ví dụ và các bài tập nền của 37 ngày; một số ngày có thêm bài nghe (liên kết MP3 ngoài).
- Bài 29/05 có bảng đếm từ hàng trăm đến hàng vạn và 62 câu luyện số lớn.
- `public/measure-words.js`: bảng 43 lượng từ, quy tắc số lớn và 595 câu luyện tập.
- `STRUCTURE_PLAN.md`: nội dung gốc cho cấu trúc câu, bài đọc và bài đặt câu mở rộng.
- `tools/build-structures.js`: kiểm tra kế hoạch và sinh dữ liệu cấu trúc cùng bài tập.
- `public/app.js`: điều khiển các tab, chấm bài, thẻ nhớ và cụm chữ gần giống.
- `public/styles.css`: bố cục cho màn hình máy tính và điện thoại.
- `tools/`: công cụ trích chữ từ PDF để cập nhật nội dung sau này.

Sau khi sửa `STRUCTURE_PLAN.md`, đồng bộ dữ liệu bằng:

```bash
npm run build:plan
```

## Kiểm tra

```bash
npm run check
npm test
```
