# 🌙 Hội Quán Ma Sói & Gián Điệp (v2.6)

Ứng dụng web chơi nhóm **5–10+ người** tại nhà — **tất cả mọi người đều là người chơi**, không ai phải đứng ngoài ra đề hay cầm trịch, không giới hạn thời gian tranh luận, **miễn phí 100%** khi đăng lên **GitHub Pages**.

---

## ✨ Điểm mới ở phiên bản v2.6
- **Làm mới toàn bộ kho nội dung Game Gián Điệp (ngắn gọn, gần gũi, dễ hiểu):**
  - Toàn bộ **125 cặp từ khóa Ai Là Gián Điệp** được tinh gọn về dạng **1–3 từ** quen thuộc đời thường (bỏ các cụm câu dài dòng), chia thành 5 bộ: *Tình Yêu & Hội Bạn*, *Ẩm Thực & Ăn Nhậu*, *Giải Trí & Công Nghệ*, *Tính Cách & Thói Quen Lầy Lội*, *Đồ Vật & Đời Sống*.
  - Rút gọn bộ câu hỏi **Điệp Viên Hỏi Xoáy** ngắn gọn, đọc lướt 2 giây hiểu ngay.
  - Thay thế các địa điểm xa lạ trong **Spyfall** (*Tàu vũ trụ*, *Tàu ngầm*) bằng địa điểm quen thuộc với hội bạn Việt Nam (*Quán nhậu vỉa hè*, *Tiệm Net / Quán Game*).

## ✨ Điểm mới ở phiên bản v2.5
- **Khóa 100% Giọng đọc Tiếng Việt + Đổi nhanh Giọng Nữ / Giọng Nam:**
  - Bổ sung `<meta name="referrer" content="no-referrer">` và lọc chặt chỉ dùng giọng `vi-VN`, loại bỏ triệt để lỗi rơi về giọng Tiếng Anh hệ điều hành (`Microsoft David`).
  - Có nút chuyển đổi trực tiếp **👩 Giọng Nữ (VI) / 👨 Giọng Nam (VI)** ngay trên thanh đầu trang, trong sảnh chờ, trong khung Bot Quản Trò khi đang chơi và trong hộp thoại Cài đặt âm thanh — bấm là áp dụng & đọc thử ngay và tự lưu vào `localStorage`.

## ✨ Điểm nổi bật từ v2.4
- **11 Vai Trò Ma Sói (thêm 4 vai trò mới + tranh thẻ bài riêng):**
  - **Sói Đầu Đàn (`alpha_wolf`):** Thức dậy cùng bầy Sói, có **1 lần duy nhất** Nguyền hóa nạn nhân bị cắn thành Ma Sói thay vì giết.
  - **Thần Tình Yêu (`cupid`):** Đêm 1 ghép 2 người thành Cặp Đôi Tình Nhân (1 người chết, người kia chết theo; nếu khác phe trở thành Phe Thứ 3 Cặp Đôi).
  - **Già Làng (`elder`):** Có **2 mạng** trước nanh vuốt Ma Sói (cắn lần đầu chỉ mất giáp).
  - **Sát Nhân Độc Hành (`serial_killer`):** Phe Thứ 3 độc lập, mỗi đêm ám sát 1 người để thành người sống sót cuối cùng!
  - Cùng **Thằng Ngố (`jester`)**, Ma Sói, Tiên Tri, Bảo Vệ, Phù Thủy, Thợ Săn, Dân Làng.
- **QR Code phóng to cực nét + Modal Quét QR từ xa:** Khung QR mặc định tăng lên `280px`, nhấn trực tiếp vào QR hoặc nút Phóng to để hiện mã QR toàn màn hình (`430px`) kèm mã phòng cực lớn.
- **Avatar cỡ lớn rõ mặt người:** Bảng chọn Avatar tăng lên `64px × 64px` và Avatar trong trận tăng lên `36px / 48px / 60px / 96px` để nhìn rõ mặt từ xa.
- **Tắt âm thanh sói hú đáng sợ:** Bỏ hoàn toàn tiếng sói tru rợn người khi đến lượt Ma Sói, thay bằng chuông đêm êm dịu.
- **Gián Điệp chuẩn Laptop Quản Trò:** Laptop chỉ đóng vai Quản Trò đọc thông báo & bấm chọn người bị vote ngoài đời (KHÔNG cầm bài chơi); tự động tính **Số lượt Vote tối đa** theo số người chơi & số Gián Điệp.
- **Giao diện tối giản chuẩn chơi Offline:** Khi vào trận, toàn bộ thanh tiêu đề, chân trang, cài đặt và bảng trạng thái thừa tự động ẩn đi — trên điện thoại chỉ giữ đúng Thẻ bài mật 3D & khu vực hành động; trên Laptop giữ sân khấu Bot Quản Trò & Bảng Vote trực tiếp.
- **24 Icon Avatar mặt người đại diện:** Chọn Avatar trước khi vào phòng, hiển thị đồng bộ kèm tên trong Phòng chờ, Lưới hành động đêm và Bảng Vote trực tiếp (hiển thị cả Avatar người vote).
- **Sửa triệt để lỗi vai trò Ma Sói & Ban đêm:** Sói không bao giờ tự cắn chính mình hoặc cắn nhầm đồng đội Ma Sói; Tiên Tri chỉ soi tối đa 1 người/đêm; Bảo Vệ & Phù Thủy kiểm tra hợp lệ chặt chẽ cả trên điện thoại lẫn Laptop.
- **Hiệu ứng lật thẻ 3D & Motion:** Lật thẻ bài 3D (`rotateY`), màu nền chuyển Đêm/Ngày mượt mà và sóng âm thanh Bot Quản Trò khi đang nói.
- **Giọng đọc AI Tiếng Việt tự nhiên hơn:** Ưu tiên dùng Google Cloud TTS (`vi-VN`), tự động tách câu ngắt nhịp mượt mà và dự phòng sang giọng trình duyệt nếu mất mạng.
- **Thẻ bài có ảnh minh họa riêng cho từng vai trò** (`assets/roles/*.png`).
- **Bỏ hoàn toàn đồng hồ đếm ngược:** Tranh luận ngoài đời thoải mái, vote xong mới chốt kết quả.
- **Bot luôn nắm rõ tình hình Vote theo thời gian thực:** Mọi người bấm Vote ngay trên điện thoại (hiển thị ai vote cho ai, ai dẫn đầu) hoặc biểu quyết miệng rồi ấn chốt trực tiếp trên máy chủ phòng.
- **Thợ Săn tự bấm trên điện thoại:** Khi Thợ Săn chết, hô bắn ở ngoài đời rồi tự chọn tên người bị bắn trên điện thoại để Bot phát tiếng súng, đọc tên và tiếp tục ván chơi.
- **Game 2: Gián Điệp có 3 chế độ cực mặn:**
  1. **Ai Là Gián Điệp:** 5 bộ chủ đề (Drama/Tình yêu, Ẩm thực/Ăn nhậu, Showbiz/Trend, Hack não, Đời sống) — 125+ cặp từ kèm gợi ý mô tả + tùy chọn **Mr. White**.
  2. **Điệp Viên Hỏi Xoáy (Câu Hỏi Lệch Pha):** Dân & Gián điệp nhận 2 câu hỏi khác nhau, trả lời xong mới lật câu hỏi thật!
  3. **Spyfall:** 30 địa điểm + 15 câu hỏi thẩm vấn mẫu + bảng chạm gạch loại trừ.

---

## 🚀 Hướng dẫn đưa lên GitHub Pages (Miễn phí 100%)

### Cách 1: Kéo-thả trực tiếp trên trình duyệt (Nhanh nhất, không cần gõ lệnh)
1. Đăng nhập [GitHub.com](https://github.com) → bấm dấu **`+`** góc trên bên phải → chọn **New repository**.
2. Đặt tên repository (ví dụ: `party-game`), chọn **Public** → bấm **Create repository**.
3. Ở trang vừa tạo, bấm dòng **uploading an existing file**.
4. Mở thư mục `d:\Project-for-antigravity\Game-Web-App` trên máy tính, chọn toàn bộ: `index.html`, `README.md`, thư mục `css`, thư mục `js`, thư mục `assets` rồi **kéo thả** vào trình duyệt (chú ý giữ nguyên cấu trúc thư mục `assets/roles/...`).
5. Đợi upload xong → bấm **Commit changes**.
6. Vào tab **Settings** (bánh răng) của repository → mục **Pages** ở cột trái:
   - Tại **Build and deployment → Source**: chọn **Deploy from a branch**.
   - Tại **Branch**: chọn **`main`** và **`/ (root)`** → bấm **Save**.
7. Đợi khoảng **1 phút** rồi F5 lại trang **Pages**, GitHub sẽ hiện đường dẫn chính thức dạng:
   `https://<ten-github-cua-ban>.github.io/party-game/`
8. Mở link đó trên Laptop/điện thoại, tạo phòng và đưa mã QR cho bạn bè quét để chơi!

### Cách 2: Đẩy bằng Git CLI (đã khởi tạo sẵn nhánh `main`)
Sau khi tạo repo trống trên GitHub (không tích README):
```sh
git remote add origin https://github.com/<ten-github-cua-ban>/<ten-repo>.git
git push -u origin main
```
Sau đó bật **Settings → Pages → Branch: `main` / `(root)`** như bước 6 ở trên.

---

## 💻 Chạy thử ngay trên máy tính (không cần GitHub)
```sh
npx serve -l 4173 .
```
Mở trình duyệt vào `http://localhost:4173`.
