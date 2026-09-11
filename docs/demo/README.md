# 🖥️ AuthService Client Demo

Thư mục này chứa giao diện mẫu chạy độc lập (Plain HTML/CSS/JS) để minh họa trực quan cách Frontend tích hợp với **AuthService**:

- **Luồng 1: Magic Link (100% Passwordless)**: Nhập email ➔ Gửi yêu cầu ➔ Xác thực `POST /verify` ➔ Nhận cặp Access/Refresh Token.
- **Luồng 2: Google OAuth & Account Linking**: Thử nghiệm đăng nhập Google với cùng email để quan sát cơ chế liên kết tài khoản (1 Email = 1 User ID duy nhất).
- **Luồng 3: Token Rotation (RTR) & Quản lý Sessions**: Gọi Protected API với Access Token Bearer và xoay vòng Refresh Token.

---

## 🚀 Cách Chạy Demo

### Bước 1: Khởi động Backend AuthService
Mở terminal tại thư mục `authservice`:
```bash
bun run dev
```
*(Backend sẽ lắng nghe tại `http://localhost:3000`)*

### Bước 2: Mở giao diện Demo
Bạn có thể mở trực tiếp file `index.html` trong trình duyệt bằng 1 trong 2 cách:
1. **Cách 1**: Kéo thả trực tiếp file `docs/demo/index.html` vào trình duyệt Chrome/Edge/Firefox.
2. **Cách 2**: Sử dụng live server hoặc lệnh:
   ```bash
   # Nếu dùng VS Code / Antigravity: Chuột phải vào docs/demo/index.html chọn "Open with Live Server"
   # Hoặc mở file trực tiếp trên Windows:
   start docs/demo/index.html
   ```

*(CORS đã được cấu hình mở sẵn trong AuthService, không bị lỗi Cross-Origin).*
