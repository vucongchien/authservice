# Tài Liệu Yêu Cầu Sản Phẩm (PRD) — Authentication Service

> **Tên dự án:** AuthService  
> **Phiên bản:** 1.1.0 (Production Ready)  
> **Công nghệ cốt lõi:** ElysiaJS (v1.4+) & Bun Runtime (v1.4+)  
> **Cơ sở dữ liệu:** SQLite (Native `bun:sqlite`, WAL Mode, ACID Transactions)  
> **Mã hóa:** RSA-2048 Asymmetric Keypair (RS256) & RFC 7517 JWKS Discovery  
> **Đóng gói:** Docker Multi-stage (`oven/bun:alpine`, ~75MB)  

---

## 1. Tổng Quan Sản Phẩm (Product Overview)

### 1.1. Bối cảnh & Vấn đề giải quyết
Trong các hệ thống phân tán và ứng dụng hiện đại, việc phân tán logic xác thực người dùng gây ra nhiều rủi ro:
- **Nguy cơ bảo mật & lỗ hổng mật khẩu:** Lưu trữ mật khẩu truyền thống dễ bị rò rỉ cơ sở dữ liệu, tấn công từ điển (brute-force), và tốn kém chi phí bảo trì luồng "quên mật khẩu".
- **Phân mảnh danh tính:** Người dùng đăng nhập bằng các phương thức khác nhau bị tạo thành nhiều tài khoản riêng biệt, làm phân mảnh dữ liệu.
- **Thắt cổ chai chịu tải (Bottleneck):** Các service nghiệp vụ liên tục phải gọi ngược HTTP về Auth Service để kiểm tra phiên làm việc.
- **Rủi ro Race Condition & Cháy Token:** Người dùng click link hoặc các luồng đồng thời dẫn đến việc token bị đốt cháy dở dang nhưng tài khoản chưa được tạo trong database.

### 1.2. Mục tiêu cốt lõi (Core Mission)
Xây dựng một **Headless Authentication Service độc lập (Plug-and-Play)** chuyên biệt với các tiêu chí khắt khe:
1. **100% Passwordless**: Loại bỏ hoàn toàn mật khẩu truyền thống. Chỉ hỗ trợ **Magic Link (Email)** và **Google OAuth (OAuth 2.1)**.
2. **Quy ước 1 Email = 1 Tài khoản duy nhất (Automatic Account Linking)**: Dù người dùng xác thực bằng Magic Link hay Google OAuth, hệ thống luôn ghép nối vào đúng 1 tài khoản duy nhất.
3. **Phân định ranh giới rõ ràng (Headless REST API)**: AuthService thuần RESTful API, **không làm BFF**, **không làm OAuth Client**, **không render HTML/Redirect**. Client (Next.js Web, Mobile App, Smart TV) tự tương tác giao diện và gọi API nhận token JSON.
4. **Xác thực phi tập trung (Decentralized Verification qua JWKS RS256)**: Các service nghiệp vụ (Order, Payment...) tự giải mã và phân quyền JWT trong bộ nhớ bằng Public Key lấy từ `/.well-known/jwks.json` mà không cần gọi ngược về AuthService.
5. **Bảo mật & Toàn vẹn dữ liệu chuẩn Production**:
   - Bọc **Database Transaction (ACID)** cho mọi thao tác ghi đa bảng, chống triệt để Race Condition.
   - Refresh Token Rotation (RTR) kết hợp **Reuse Detection** thu hồi toàn bộ Token Family khi bị tấn công chiếm đoạt.
   - Quản lý phiên đa thiết bị (Multi-device Session Tracking & Remote Logout).
   - Danh mục mã lỗi và thông điệp chuẩn hóa tập trung (`src/common/errors.ts`).

---

## 2. Quy Ước Định Danh Cốt Lõi (Core Identity Conventions)

### Quy tắc 1: Email là Khóa Định Danh Duy Nhất (Unique Identity Key)
* Địa chỉ email là định danh gốc (Primary Identity) duy nhất của người dùng trên toàn hệ thống.
* Trường `email` trong bảng `users` được chuẩn hóa (`trim().toLowerCase()`) và đặt ràng buộc `UNIQUE`.

### Quy tắc 2: Tự Động Ghép Nối Tài Khoản (Automatic Account Linking)
* Nếu người dùng đăng ký trước qua **Magic Link** với email `user@gmail.com` ➔ Hệ thống tạo User `U1`.
* Khi người dùng bấm **"Đăng nhập bằng Google"** với cùng email `user@gmail.com` ➔ Google chứng thực `email_verified: true` ➔ Hệ thống tự động liên kết Google ID vào User `U1`.
* **Kết quả:** Không bao giờ tạo 2 tài khoản trùng email. Dữ liệu đơn hàng, cài đặt của người dùng luôn được bảo toàn 100%.

---

## 3. Trách Nhiệm & Ranh Giới Của AuthService

### 3.1. Phạm vi trách nhiệm thực tế của AuthService
AuthService đóng vai trò là **Identity & Token Issuer độc lập**, cung cấp các RESTful API thuần túy:
1. **Xác thực Magic Link**: Nhận email ➔ băm SHA-256 lưu token DB ➔ phát event gửi mail ➔ xác thực token 1 lần (Single-use) qua `POST /magic-link/verify` ➔ cấp phát phiên.
2. **Xác thực Google OAuth (OAuth 2.1)**: Tiếp nhận `idToken` (từ Mobile Native / Web GIS) hoặc cặp `{ code, codeVerifier }` (Web PKCE) ➔ verify chữ ký số Google ➔ liên kết tài khoản theo Email ➔ cấp phát phiên.
3. **Smart TV Device Authorization (RFC 8628)**: Cấp mã thiết bị và mã người dùng (`user_code`), hỗ trợ polling và xác thực từ xa trên điện thoại/máy tính cho Smart TV.
4. **Quản trị Vòng đời Token**: Ký Access Token RS256; xoay vòng Refresh Token (RTR) và kích hoạt Reuse Detection khóa toàn bộ token family khi bị replay token cũ.
5. **Quản lý Phiên (Session Management)**: Lưu vết và thu hồi phiên theo từng thiết bị (IP, User-Agent, OS). Hỗ trợ xem danh sách thiết bị và đăng xuất từ xa.
6. **Công bố Khóa Công Khai (JWKS)**: Cung cấp endpoint chuẩn `/.well-known/jwks.json` để bên thứ ba tự xác thực Access Token cục bộ.

### 3.2. Ranh giới (Những gì AuthService KHÔNG làm)
* **KHÔNG phải OAuth Client**: Không quản lý giao diện popup hay màn hình đăng nhập Google. Mọi tương tác giao diện do Client (Next.js / Mobile) tự đảm nhận.
* **KHÔNG có URL Callback hay Redirect**: Không render HTML, không can thiệp vào URL trình duyệt của người dùng.
* **KHÔNG lưu Cookie phía Server hay làm BFF**: Trả về Token thuần JSON cho Client tự quản lý lưu trữ (Secure Storage / Cookie httpOnly của Frontend).
* **KHÔNG làm phân quyền tài nguyên chi tiết (Resource-level AuthZ)**: Chỉ nhúng `user_id` và `roles` cấp hệ thống (`['admin', 'user']`) vào JWT. Logic ai được xem đơn hàng nào thuộc về từng business service.

### 3.3. Sơ đồ luồng xử lý nội tại của AuthService
```text
[Request từ Client: Magic Link Token hoặc Google IdToken/PKCE]
                         │
                         ▼
        [Kiểm tra tính hợp lệ & Chữ ký số]
                         │
                         ▼
       [Khối DB Transaction: Atomic Consistency]
       ├── Kiểm tra & Đánh dấu token dùng 1 lần (AND is_used = 0)
       ├── Tra cứu hoặc tạo mới User theo Email duy nhất
       └── Liên kết OAuth Provider vào User (nếu là Google)
                         │
                         ▼
        [Cấp cặp Token: Ký JWT RS256 + Sinh Refresh Token]
                         │
                         ▼
        [200 OK: Trả về accessToken, refreshToken, user]
```

---

## 4. Yêu Cầu Chức Năng Chi Tiết (Functional Requirements)

### 4.1. Phân hệ Magic Link (Passwordless qua Email)
* **Gửi yêu cầu (`POST /api/v1/auth/magic-link`)**:
  * Nhận `{ email }`.
  * Validate định dạng email.
  * Sinh token bảo mật ngẫu nhiên (32 bytes crypto random), băm SHA-256 lưu vào Database, TTL 15 phút.
  * **Chống rò rỉ danh sách người dùng (Anti-enumeration)**: Luôn trả về thông điệp chung: *"Nếu email hợp lệ, link đăng nhập bảo mật đã được gửi tới hòm thư của bạn"*.
  * **Event-Driven Decoupled**: Bắn event `auth.email.magic_link` qua EventBus. Môi trường Dev in ra Terminal Banner trực quan; môi trường Production cắm Worker gửi email thực tế.
* **Xác thực link (`POST /api/v1/auth/magic-link/verify`) — Single Source of Truth**:
  * Nhận `{ token }`.
  * **Tại sao chỉ dùng POST (Loại bỏ hoàn toàn GET)?**:
    * *Bẫy Bot Email Scanner:* Các dịch vụ email hiện đại (Gmail, Outlook Defender, Antivirus) luôn có bot tự động gửi request `GET` để quét link mã độc trước khi người dùng đọc thư. Nếu dùng `GET`, bot sẽ kích hoạt và đốt cháy token dùng 1 lần, khiến người dùng thật bị báo lỗi "token đã hết hạn".
    * *Chuẩn HTTP:* Phương thức `GET` bắt buộc phải là an toàn/chỉ đọc (safe/idempotent), không được làm thay đổi trạng thái database.
  * **Bọc Database Transaction:** Thực hiện câu lệnh nguyên tử:
    ```sql
    UPDATE magic_link_tokens SET is_used = 1 WHERE id = ? AND is_used = 0;
    ```
    Nếu có 100 requests đồng thời giẫm lên cùng 1 token, chỉ đúng 1 request cập nhật thành công (`changes === 1`), 99 request còn lại lập tức nhận lỗi `400 INVALID_OR_EXPIRED_TOKEN`.
  * **Tự động đăng ký (Auto-register):** Tạo User mới nếu email chưa tồn tại (`isNewUser: true`) trong cùng transaction, đảm bảo không bao giờ có lỗi token bị cháy mà user không được tạo.
  * Cấp cặp Access Token (RS256) và Refresh Token ban đầu.

### 4.2. Phân hệ Google OAuth (OAuth 2.1 Standard)
* **Endpoint duy nhất (`POST /api/v1/auth/oauth/google`)**:
  * Không dùng tên sai ngữ nghĩa như `/google/callback`.
  * **Cơ chế phẳng (Flat Flow):** Cả 2 luồng đều quy về việc lấy Google ID Token:
    1. **Google ID Token (Mobile SDK / Web GIS)**: `{ idToken }` ➔ Verify chữ ký số Google trực tiếp.
    2. **PKCE Code Flow (Web Next.js)**: `{ code, codeVerifier, redirectUri }` ➔ Hàm `resolveIdToken()` gọi Google Token Endpoint đổi lấy `idToken`.
  * **Bọc Database Transaction:** Thực hiện atomic upsert User và liên kết vào bảng `oauth_accounts`.

### 4.3. Phân hệ Smart TV / Thiết bị hạn chế Input (RFC 8628 Device Flow)
* **Cấp mã thiết bị (`POST /api/v1/auth/oauth/device/code`)**:
  * TV gọi API nhận `device_code` (bí mật của TV) và `user_code` (8 ký tự dễ đọc, ví dụ: `WDJB-MJHT`) hiển thị lên màn hình kèm link xác thực.
* **Polling định kỳ (`POST /api/v1/auth/oauth/device/poll`)**:
  * TV poll token định kỳ mỗi 5 giây.
  * Trả về `AUTHORIZATION_PENDING` khi chưa xác thực, `CODE_EXPIRED` khi quá hạn.
  * Khi user đã duyệt: Đánh dấu `CONSUMED` nguyên tử qua transaction và cấp cặp token cho TV.
* **Người dùng duyệt quyền (`POST /api/v1/auth/oauth/device/authorize`)**:
  * Người dùng nhập `user_code` trên điện thoại/máy tính sau khi đăng nhập để cấp quyền cho TV.

### 4.4. Phân hệ Token & Chống Đánh Cắp Phiên (Token Rotation & Reuse Detection)
* **Cấu trúc Token**:
  * **Access Token**: JWT ký bằng RSA Private Key (RS256). Thời hạn sống ngắn (15 phút). Payload chứa: `sub` (user_id), `email`, `roles`, `familyId`.
  * **Refresh Token**: Chuỗi ngẫu nhiên 32 bytes (Opaque Token). Lưu mã băm **SHA-256** trong DB, gắn với `family_id` của thiết bị. TTL 14 ngày.
* **Token Rotation (RTR) khi gọi `POST /api/v1/auth/token/refresh`**:
  * Đánh dấu token cũ `is_revoked = 1 WHERE id = ? AND is_revoked = 0` qua transaction ➔ Cấp Refresh Token mới cùng `family_id` ➔ Ký Access Token mới.
* **Reuse Detection (Báo động đỏ khi token bị đánh cắp)**:
  * Nếu một refresh token cũ **đã bị revoke** được gửi lên lại ➔ Phát hiện hành vi replay token bị đánh cắp!
  * **Hành động tức thì**: Lập tức thu hồi **TOÀN BỘ chuỗi token thuộc cùng `family_id`** (`UPDATE refresh_tokens SET is_revoked = 1 WHERE family_id = ?`).
  * Trả về lỗi `401 TOKEN_REUSE_DETECTED`, ép đăng xuất toàn bộ phiên làm việc của chuỗi token đó để bảo vệ tài khoản.

### 4.5. Phân hệ Quản Lý Phiên Đa Thiết Bị (Multi-Device Management)
* **Khái niệm Session vs Token**:
  * *Token (Stateless):* Vật mang danh tính tạm thời dùng để gọi API hàng ngày.
  * *Session (Stateful):* Đại diện cho sự hiện diện của 1 thiết bị cụ thể trong DB (quản lý qua `family_id`).
* `GET /api/v1/auth/sessions`: Lấy danh sách các thiết bị đang hoạt động (gom nhóm theo `family_id`, phân biệt thiết bị hiện tại qua cờ `isCurrent`).
* `DELETE /api/v1/auth/sessions/:id`: Đăng xuất/thu hồi một thiết bị cụ thể từ xa.
* `DELETE /api/v1/auth/sessions`: Đăng xuất khỏi tất cả các thiết bị khác (trừ thiết bị hiện tại).
* `POST /api/v1/auth/logout`: Đăng xuất phiên hiện tại.

### 4.6. Phân hệ Phân Quyền Cấp Hệ Thống (System-level Roles)
* User có trường `roles` kiểu JSON Array trong DB (mặc định `["user"]`).
* `PATCH /api/v1/admin/users/:id/roles`: Admin cập nhật roles cho user (được bảo vệ bằng macro guard `isAdmin: true`).

### 4.7. Phân hệ Xác Thực Phi Tập Trung (Decentralized JWKS Discovery)
* `GET /.well-known/jwks.json`: Public endpoint xuất bản Public Key theo chuẩn **RFC 7517 (JWKS)**.
* Header: `Cache-Control: public, max-age=86400`.
* Các service khác tải về, cache lại và tự giải mã JWT Access Token mà không cần gọi ngược về AuthService.

---

## 5. Danh Mục Mã Lỗi & Thông Điệp Chuẩn Hóa (`src/common/errors.ts`)

Mọi phản hồi lỗi đều có cấu trúc JSON đồng nhất:
```json
{
  "error": "MÃ_LỖI_CHUẨN",
  "message": "Thông điệp mô tả chi tiết bằng tiếng Việt"
}
```

| HTTP Status | Mã Lỗi (`error`) | Mô Tả Nghiệp Vụ |
| :--- | :--- | :--- |
| `400` | `INVALID_OR_EXPIRED_TOKEN` | Token Magic Link không tồn tại, đã hết hạn hoặc đã được sử dụng |
| `400` | `INVALID_CREDENTIALS` | Thiếu `idToken` hoặc cặp `code / codeVerifier` Google hợp lệ |
| `400` | `INVALID_ID_TOKEN` | Google ID Token không hợp lệ hoặc email chưa được xác thực |
| `400` | `INVALID_DEVICE_CODE` | Mã thiết bị TV không hợp lệ |
| `400` | `CODE_EXPIRED` | Phiên đăng nhập trên thiết bị TV đã hết hạn |
| `400` | `AUTHORIZATION_PENDING`| Thiết bị TV đang chờ người dùng xác nhận trên điện thoại/máy tính |
| `400` | `CODE_ALREADY_USED` | Mã xác thực thiết bị TV đã được sử dụng |
| `400` | `CODE_ALREADY_PROCESSED` | Mã xác thực thiết bị TV đã được xử lý trước đó |
| `401` | `UNAUTHORIZED` | Thiếu Bearer Access Token hợp lệ trong Authorization header |
| `401` | `INVALID_REFRESH_TOKEN`| Refresh token không hợp lệ hoặc đã hết hạn |
| `401` | `TOKEN_REUSE_DETECTED` | Phát hiện token bị tái sử dụng. Toàn bộ phiên làm việc đã bị thu hồi |
| `403` | `FORBIDDEN` | Không có quyền thực hiện thao tác (yêu cầu quyền Admin) |
| `403` | `ACCOUNT_DISABLED` | Tài khoản đã bị khóa hoặc vô hiệu hóa |
| `404` | `USER_NOT_FOUND` | Không tìm thấy người dùng trong hệ thống |
| `404` | `SESSION_NOT_FOUND` | Phiên làm việc không tồn tại hoặc đã bị thu hồi trước đó |
| `404` | `INVALID_USER_CODE` | Mã thiết bị người dùng nhập không tồn tại hoặc đã hết hạn |

---

## 6. Danh Sách RESTful API Hoàn Chỉnh

| Phương Thức | Endpoint URL | Mục Đích | Yêu Cầu Xác Thực |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/magic-link` | Yêu cầu gửi link đăng nhập qua email | Public |
| `POST` | `/api/v1/auth/magic-link/verify` | Xác thực link đăng nhập & cấp token (Single Source) | Public |
| `POST` | `/api/v1/auth/oauth/google` | Đăng nhập Google (Mobile SDK hoặc Web PKCE) | Public |
| `POST` | `/api/v1/auth/oauth/device/code` | Smart TV xin mã xác thực thiết bị (RFC 8628) | Public |
| `POST` | `/api/v1/auth/oauth/device/poll` | Smart TV poll token định kỳ | Public |
| `POST` | `/api/v1/auth/oauth/device/authorize` | Người dùng cấp quyền cho TV trên điện thoại/PC | Bearer Access Token |
| `POST` | `/api/v1/auth/token/refresh` | Làm mới Access Token (Token Rotation + Reuse Detection) | Public (Cần Refresh Token) |
| `POST` | `/api/v1/auth/logout` | Đăng xuất phiên hiện tại | Public (Cần Refresh Token) |
| `GET` | `/api/v1/auth/sessions` | Xem danh sách thiết bị đang đăng nhập | Bearer Access Token |
| `DELETE`| `/api/v1/auth/sessions/:id` | Đăng xuất 1 thiết bị cụ thể | Bearer Access Token |
| `DELETE`| `/api/v1/auth/sessions` | Đăng xuất khỏi tất cả các thiết bị khác | Bearer Access Token |
| `PATCH`| `/api/v1/admin/users/:id/roles` | Admin phân quyền vai trò hệ thống | Bearer Token có Role `admin` |
| `GET` | `/.well-known/jwks.json` | Xuất bản Public Key (RFC 7517) cho service khác | Public |
| `GET` | `/swagger` | Giao diện tài liệu OpenAPI 3.0 | Public |

---

## 7. Thiết Kế Cơ Sở Dữ Liệu Tinh Gọn (Database Schema)

Sử dụng **SQLite** (Native `bun:sqlite`, chế độ **WAL Mode**):

```sql
-- 1. Bảng người dùng (Users)
CREATE TABLE users (
  id TEXT PRIMARY KEY,               -- UUID v4
  email TEXT UNIQUE NOT NULL,        -- Định danh duy nhất toàn hệ thống
  is_active INTEGER NOT NULL DEFAULT 1,
  roles TEXT NOT NULL DEFAULT '["user"]', -- JSON Array: ['admin', 'user']
  created_at INTEGER NOT NULL,       -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL
);

-- 2. Bảng liên kết mạng xã hội (OAuth Accounts)
CREATE TABLE oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,            -- 'google'
  provider_user_id TEXT NOT NULL,    -- Google sub ID
  created_at INTEGER NOT NULL,
  UNIQUE(provider, provider_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. Bảng lưu token Magic Link tạm thời
CREATE TABLE magic_link_tokens (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,   -- SHA-256(rawToken)
  expires_at INTEGER NOT NULL,       -- TTL 15 phút
  is_used INTEGER NOT NULL DEFAULT 0,-- Single-use flag
  created_at INTEGER NOT NULL
);

-- 4. Bảng quản lý Refresh Token & Phiên thiết bị (Sessions)
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,   -- SHA-256(rawRefreshToken)
  family_id TEXT NOT NULL,           -- Đại diện cho 1 thiết bị/phiên cụ thể
  is_revoked INTEGER NOT NULL DEFAULT 0,
  device_info TEXT,                  -- JSON: { ip, userAgent, os, browser }
  expires_at INTEGER NOT NULL,       -- TTL 14 ngày
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Bảng ủy quyền thiết bị Smart TV (RFC 8628 Device Codes)
CREATE TABLE device_codes (
  id TEXT PRIMARY KEY,
  device_code TEXT UNIQUE NOT NULL,  -- Bí mật của thiết bị TV
  user_code TEXT UNIQUE NOT NULL,    -- Mã 8 ký tự hiển thị lên màn hình (WDJB-MJHT)
  user_id TEXT,                      -- Gắn sau khi user duyệt
  status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | AUTHORIZED | CONSUMED | EXPIRED
  expires_at INTEGER NOT NULL,       -- TTL 10 phút
  created_at INTEGER NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chỉ mục tối ưu tốc độ truy vấn:
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_magic_link_hash ON magic_link_tokens(token_hash);
CREATE INDEX idx_refresh_token_hash ON refresh_tokens(token_hash);
CREATE INDEX idx_refresh_token_family ON refresh_tokens(family_id);
CREATE INDEX idx_device_code ON device_codes(device_code);
CREATE INDEX idx_user_code ON device_codes(user_code);
```

---

## 8. Đóng Gói & Triển Khai (Deployment & Performance Specs)

### 8.1. Đóng gói Container (Docker & Compose)
* **Dockerfile Multi-Stage (`oven/bun:alpine`)**:
  * Dung lượng image: **~75MB**.
  * Chạy dưới quyền người dùng không đặc quyền (`USER bun`).
  * Kiểm tra sức khỏe tự động qua `HEALTHCHECK wget -qO- http://localhost:3000/.well-known/jwks.json`.
* **Docker Compose (`docker-compose.yml`)**:
  * Cấu hình gắn volume đĩa `./data:/app/data` lưu SQLite bền vững trên host.
  * Giới hạn an toàn: 512MB RAM, 1.0 CPU, chính sách `restart: unless-stopped`.

### 8.2. Kết Quả Đo Tải Thực Tế (Benchmark & Concurrency Specs)
* **Anti-Race Condition Concurrency:**
  * 100 requests đồng thời giẫm lên cùng 1 token Magic Link ➔ Đúng 1 request thành công, 99 request bị từ chối sạch sẽ, tạo đúng 1 user trong DB.
  * 50 requests đồng thời xoay vòng cùng 1 Refresh Token ➔ Kích hoạt Reuse Detection ngay lập tức, vô hiệu hóa an toàn toàn bộ Token Family.
* **Throughput & Latency (HTTP Benchmark 10.000 Requests):**
  * Thông lượng đỉnh: **~1.000 req/s** (với 50 kết nối đồng thời).
  * Độ trễ phân vị: p50 = **49.03ms**, p95 = **60.83ms**, p99 = **78.40ms** (ở mức 1.000 requests).
  * Tỷ lệ lỗi: **0.00%** across 11.100 requests, **0 lỗi `SQLITE_BUSY`**.
* **Kiểm thử tự động & Typecheck:**
  * `bun run typecheck`: Quét sạch 100% lỗi TypeScript tĩnh (`tsc --noEmit`).
  * `bun test`: **27 pass / 0 fail** trên 13 test files.
