# 🛡️ AuthService — Ultra-Fast, 100% Passwordless Authentication Microservice

<p align="center">
  <img src="https://img.shields.io/badge/Runtime-Bun%20v1.4+-black?style=for-the-badge&logo=bun" alt="Bun">
  <img src="https://img.shields.io/badge/Framework-ElysiaJS%20v1.4+-f28b82?style=for-the-badge" alt="ElysiaJS">
  <img src="https://img.shields.io/badge/Architecture-Clean%20Architecture-4285F4?style=for-the-badge" alt="Clean Architecture">
  <img src="https://img.shields.io/badge/Database-SQLite%20%7C%20PostgreSQL-34A853?style=for-the-badge" alt="Database">
  <img src="https://img.shields.io/badge/Deploy-Render%20Ready-46E3B7?style=for-the-badge&logo=render&logoColor=white" alt="Render">
  <img src="https://img.shields.io/badge/Docker-~75MB%20Alpine-2496ED?style=for-the-badge&logo=docker" alt="Docker">
  <img src="https://img.shields.io/badge/Tests-31%2F31%20Passing-brightgreen?style=for-the-badge" alt="Tests">
</p>

<p align="center">
  <a href="https://render.com/deploy" target="_blank">
    <img src="https://render.com/images/deploy-to-render-button.svg" alt="Deploy to Render">
  </a>
</p>

---

**AuthService** là dịch vụ xác thực **100% Passwordless**, hiệu năng cực cao, thiết kế chuẩn **Headless RESTful API** và kiến trúc **Clean Architecture (Ports & Adapters)**. Dịch vụ sẵn sàng cắm-và-chạy (Plug-and-Play) độc lập cho các hệ sinh thái Microservices hiện đại, loại bỏ hoàn toàn các điểm yếu của mật khẩu truyền thống và OTP SMS.

---

## 🌟 Tính Năng Cốt Lõi

- 🚫 **100% Passwordless**: Loại bỏ hoàn toàn mật khẩu.
- 📬 **Single-Use Magic Link**: Chống bot quét email (chỉ nhận `POST /verify`).
- 🌐 **Google OAuth 2.1 & Account Linking**: 1 Email = 1 Tài khoản duy nhất.
- 📺 **Smart TV Device Flow**: Chuẩn RFC 8628 (mã User Code 8 ký tự).
- 🔄 **Refresh Token Rotation (RTR)**: Cơ chế thu hồi phiên khi phát hiện Token Reuse.
- 🔑 **Xác thực phi tập trung JWKS**: Phân phối RSA Public Key (`/.well-known/jwks.json`).
- 🔌 **Đa cơ sở dữ liệu (Pluggable DB)**: Mặc định SQLite, hỗ trợ PostgreSQL qua `.env`.
- ⚡ **Hiệu năng & An toàn đồng thời**: Chống Race Condition và Transaction nguyên tử.

> 📖 *Chi tiết kiến trúc kỹ thuật, luồng nghiệp vụ và đặc tả API xem tại [Tài liệu PRD](docs/PRD.md).*

---

## 🏛️ Kiến Trúc Hệ Thống

Hệ thống tuân thủ nghiêm ngặt nguyên lý **Dependency Inversion (DIP)**: Tầng nghiệp vụ không phụ thuộc vào Database Driver; cả hai cùng phụ thuộc vào Interface Port.

```
src/
├── core/                                         # [TẦNG DOMAIN & PORTS - Pure TypeScript]
│   ├── models/index.ts                           # Domain Entities: User, RefreshToken, OAuthAccount...
│   └── ports/                                    # Hợp đồng dữ liệu (Ports)
│       ├── user.repository.ts                    # IUserRepository
│       ├── magic-link.repository.ts              # IMagicLinkRepository
│       ├── token.repository.ts                   # IRefreshTokenRepository
│       ├── oauth.repository.ts                   # IOAuthRepository
│       ├── device.repository.ts                  # IDeviceCodeRepository
│       └── database.port.ts                      # IDatabase (Master Port)
│
├── infrastructure/database/                      # [TẦNG HẠ TẦNG - DRIVEN ADAPTERS]
│   ├── sqlite/                                   # Adapter 1: bun:sqlite (Mặc định local)
│   ├── postgres/                                 # Adapter 2: postgres.js (Cắm vào qua env)
│   └── factory.ts                                # Factory tự động chọn Adapter dựa trên .env
│
└── modules/                                      # [TẦNG NGHIỆP VỤ - ỨNG DỤNG]
    ├── auth/service.ts                           # 0 câu lệnh SQL - Thuần Domain Logic
    ├── oauth/service.ts                          # Account Linking logic
    ├── oauth/device.service.ts                   # RFC 8628 Smart TV logic
    ├── session/service.ts                        # Session tracking & Remote logout
    └── admin/service.ts                          # Phân quyền Role hệ thống
```

```mermaid
flowchart TD
  subgraph Client["📱 Frontend Clients & Live Demo"]
    U["User"] -->|1. Request Link| ML["POST /api/v1/auth/magic-link"]
    U -->|2. Verify Token| V["POST /api/v1/auth/magic-link/verify"]
    U -->|Google OAuth 2.1| G["POST /api/v1/auth/oauth/google"]
    U -->|Smart TV RFC 8628| TV["POST /api/v1/auth/oauth/device/*"]
  end

  subgraph Core["🛡️ AuthService Core (Elysia + Bun)"]
    ML --> EV["EventBus: Email Dispatcher"]
    V --> TX["Atomic DB Transaction"]
    G --> TX
    TV --> TX
    TX --> JWT["RS256 JWT Access Token + Opaque Refresh Token"]
  end

  subgraph DB["💾 Pluggable Storage (Ports & Adapters)"]
    TX --> ADAPTER["Database Adapter"]
    ADAPTER --> SQLITE["SQLite (Mặc định WAL)"]
    ADAPTER --> PG["PostgreSQL (Render Production)"]
  end

  subgraph Services["🌐 Satellite Microservices"]
    JWT -.->|Xác thực phi tập trung| JWKS["GET /.well-known/jwks.json"]
  end
```

---

## 📋 Danh Sách API Endpoints

Tài liệu Swagger tương tác trực quan có sẵn tại: `http://localhost:3000/swagger`

| Phương thức | Đường dẫn API | Xác thực | Mô tả chi tiết |
| :--- | :--- | :---: | :--- |
| `POST` | `/api/v1/auth/magic-link` | Không | Yêu cầu gửi Magic Link đăng nhập qua Email |
| `POST` | `/api/v1/auth/magic-link/verify` | Không | Xác thực token Magic Link & tự động tạo tài khoản |
| `POST` | `/api/v1/auth/token/refresh` | Không | Xoay vòng Refresh Token (RTR) & cấp Access Token mới |
| `POST` | `/api/v1/auth/logout` | Không | Thu hồi Refresh Token hiện tại (Đăng xuất) |
| `POST` | `/api/v1/auth/oauth/google` | Không | Đăng nhập Google qua ID Token hoặc PKCE Code |
| `POST` | `/api/v1/auth/oauth/device/code` | Không | Thiết bị Smart TV yêu cầu cặp mã xác thực |
| `POST` | `/api/v1/auth/oauth/device/poll` | Không | Smart TV định kỳ thăm dò trạng thái cấp quyền (Poll) |
| `POST` | `/api/v1/auth/oauth/device/authorize` | Bearer | Người dùng phê duyệt thiết bị trên Web/Mobile |
| `GET` | `/api/v1/auth/sessions` | Bearer | Xem danh sách các thiết bị/phiên đang hoạt động |
| `DELETE` | `/api/v1/auth/sessions/:id` | Bearer | Đăng xuất từ xa một thiết bị cụ thể |
| `DELETE` | `/api/v1/auth/sessions` | Bearer | Đăng xuất khỏi tất cả các thiết bị khác |
| `GET` | `/.well-known/jwks.json` | Không | Cung cấp Public Key RSA cho các Microservices khác |
| `GET` | `/demo` hoặc `/demo/` | Không | Giao diện Live Demo client tích hợp sẵn |
| `GET` | `/health` | Không | Endpoint kiểm tra sức khỏe của dịch vụ |
| `PATCH` | `/api/v1/admin/users/:id/roles` | Admin | Quản lý và phân quyền Role hệ thống |

---

## 🚀 Hướng Dẫn Bắt Đầu Nhanh

### 1. Yêu cầu hệ thống
- Đã cài đặt [Bun](https://bun.sh/) (phiên bản v1.1 trở lên).

### 2. Cài đặt & Khởi chạy
```bash
# 1. Clone repository
git clone https://github.com/your-username/ult-module-service.git
cd ult-module-service/authservice

# 2. Cài đặt dependencies
bun install

# 3. Tạo file cấu hình môi trường từ mẫu
cp .env.example .env

# 4. Khởi chạy dev server (tự reload khi sửa code)
bun run dev
```

Hệ thống sẽ khởi động tại: `http://localhost:3000`
- API Health Check: `http://localhost:3000/health`
- Swagger UI Documentation: `http://localhost:3000/swagger`
- JWKS Endpoint: `http://localhost:3000/.well-known/jwks.json`
- Giao diện Live Demo: `http://localhost:3000/demo/` (hoặc mở file [docs/demo/index.html](docs/demo/index.html))

> 💡 **Lưu ý về Database**: Hệ thống mặc định chạy **SQLite** (`./data/authservice.db`) không cần cài đặt gì thêm. Nếu muốn dùng **PostgreSQL**, chỉ cần khai báo `DATABASE_URL=postgres://user:pass@host:5432/db` trong `.env` là hệ thống sẽ tự kết nối và tự tạo bảng (`CREATE TABLE IF NOT EXISTS`).

---

## 🐳 Triển Khai Với Docker

Khởi chạy nhanh toàn bộ dịch vụ qua Docker Compose (Alpine image ~75MB):
```bash
docker-compose up -d
```

---

## 🚀 Triển Khai Lên Render & Tự Động Hóa CD

Dự án cấu hình sẵn **Render Blueprint** ([render.yaml](render.yaml)) và **CD Pipeline** qua GitHub Actions:
1. **Triển khai 1-Click (Infrastructure as Code)**:
   - Vào [Render Dashboard](https://dashboard.render.com/) ➔ **New** ➔ **Blueprint**.
   - Kết nối repository GitHub này. Render sẽ tự động tạo **Web Service (Docker)** và **PostgreSQL Database (Free)** với kết nối `DATABASE_URL` hoàn toàn tự động.
2. **Continuous Deployment (CD)**:
   - Workflow [.github/workflows/ci.yml](.github/workflows/ci.yml) tự động chạy linter, typecheck, kiểm thử đồng thời và build Docker.
   - Thêm secret `RENDER_DEPLOY_HOOK_URL` vào GitHub Repo. Khi push vào nhánh `main`/`master`, CD pipeline sẽ kích hoạt Render triển khai phiên bản mới nhất ngay khi toàn bộ test pass 100%.
3. **Live Demo Trên Production**:
   - Truy cập ngay `https://<ten-app>.onrender.com/demo/` để thử nghiệm trực quan luồng Magic Link & Google OAuth.

---

## 🧪 Kiểm Thử

```bash
bun test            # Chạy 27 bài test Unit & E2E
bun run test:stress # Kiểm tra chống Race Condition & Transaction
bun run lint        # Kiểm tra linter & format với Biome
```

> 📖 *Chi tiết danh mục và kịch bản kiểm thử xem tại [Tài liệu test](test/README.md). Cấu hình biến môi trường xem tại [.env.example](.env.example).*

---

## 📄 Giấy Phép Bản Quyền

Phát hành dưới giấy phép mã nguồn mở [MIT License](LICENSE).
Tự do sử dụng, tích hợp và triển khai trong các dự án cá nhân và thương mại.