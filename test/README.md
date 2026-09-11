# Tài Liệu & Mục Lục Kiểm Thử (AuthService Test Suite)

Tài liệu này mô tả toàn bộ mục tiêu, kịch bản kiểm thử (Test Scenarios) và cấu trúc các bài test của hệ thống **AuthService (Elysia + Bun)**.

---

## 1. Cách Thức Chạy Test

```bash
# Chạy toàn bộ test suite (28 bài test)
bun test

# Chạy riêng unit test
bun test test/unit

# Chạy riêng e2e test
bun test test/e2e

# Chạy Stress Test chống Race Condition & kiểm tra Transaction
bun run test:stress

# Chạy HTTP Benchmark tải lớn (10.000 requests)
bun run test:benchmark
```

---

## 2. Mục Lục Kiểm Thử Chi Tiết

### 2.1. Unit Tests (`test/unit/`)
| File Test | Module / Thành Phần | Kịch Bản & Mục Tiêu Kiểm Thử |
| :--- | :--- | :--- |
| `keys.test.ts` | `config/keys.ts` | - Sinh cặp khóa RSA 2048 hợp lệ<br>- Ký JWT và giải mã JWT thành công với thuật toán RS256<br>- Export định dạng chuẩn JWKS với đúng `kid`, `use: 'sig'`, `alg: 'RS256'` |
| `utils.test.ts` | `common/utils.ts` | - Mã hóa hashToken (SHA-256)<br>- Sinh chuỗi secure token ngẫu nhiên không trùng lặp<br>- Sinh mã TV (User Code) 8 ký tự dạng `XXXX-XXXX`<br>- Xác thực PKCE (RFC 7636) với phương thức `S256` và `plain` |
| `auth.service.test.ts` | `modules/auth/service.ts` | - Tạo Magic Link token & lưu DB<br>- Chống User Enumeration: email nào cũng trả cùng thông điệp<br>- Verify Magic link: tự động tạo user mới nếu email chưa có<br>- Token Rotation: Cấp RT mới, hủy RT cũ<br>- **Reuse Detection**: Dùng lại RT cũ lập tức thu hồi toàn bộ Token Family |
| `device.service.test.ts` | `modules/oauth/device.service.ts`| - Cấp device_code và user_code cho TV<br>- TV poll khi trạng thái PENDING -> trả về pending<br>- User authorize mã trên web/phone<br>- TV poll sau khi authorize -> nhận cặp Access/Refresh Token |

---

### 2.2. E2E Tests (`test/e2e/`)
| File Test | Kịch Bản Kiểm Thử Xuyên Suốt (End-to-End API) |
| :--- | :--- |
| `magic-link.test.ts` | `POST /api/v1/auth/magic-link` -> `POST /api/v1/auth/magic-link/verify`<br>- Request link thành công, EventBus bắn event<br>- Verify link thành công -> Trả `is_new_user: true`, Access Token (RS256) & Refresh Token<br>- Verify lại link lần 2 -> Bị từ chối (Single-use token) |
| `token-rotation.test.ts` | `POST /api/v1/auth/token/refresh`<br>- Dùng RT hợp lệ -> Nhận AT mới và RT mới<br>- Dùng RT cũ đã bị rotate -> Bị lỗi `TOKEN_REUSE_DETECTED`, toàn bộ chuỗi token family bị vô hiệu hóa |
| `account-linking.test.ts` | **Quy ước Định danh (1 Email = 1 Acc)**:<br>- User đăng ký qua Magic link với `alice@test.com`<br>- Đăng nhập Google qua `POST /api/v1/auth/oauth/google` với cùng email `alice@test.com`<br>- Xác nhận hệ thống trả về cùng một `user_id` duy nhất, không tạo user rác |
| `device-flow.test.ts` | `POST /api/v1/auth/oauth/device/code` -> `poll` -> `authorize` -> `poll`<br>- Hoàn tất luồng đăng nhập TV không cần bàn phím |
| `session.test.ts` | `GET /api/v1/auth/sessions` -> `DELETE /api/v1/auth/sessions/:id`<br>- Xem danh sách thiết bị đang đăng nhập<br>- Thu hồi phiên cụ thể hoặc thu hồi tất cả phiên khác |
| `jwks.test.ts` | `GET /.well-known/jwks.json`<br>- Service bên ngoài tải JWKS về và tự verify Access Token mà không cần gọi Auth Service |
| `demo.test.ts` | `GET /demo`, `/demo/`, `/demo/style.css`, `/demo/app.js`<br>- Phục vụ tĩnh giao diện Demo Client trực tiếp từ Docker container |

---

### 2.3. Stress & Concurrency Tests (`test/stress/`)
| File Test | Lệnh Chạy | Kịch Bản & Mục Tiêu Kiểm Thử |
| :--- | :--- | :--- |
| `concurrency.test.ts` | `bun run test:stress` | - **100 requests đồng thời giẫm lên 1 Magic Link**: Đúng 1 thành công, 99 fail với `400 INVALID_OR_EXPIRED_TOKEN`.<br>- **50 requests đồng thời xoay vòng 1 Refresh Token**: Bẫy Reuse Detection được kích hoạt ngay lập tức, toàn bộ Token Family bị thu hồi.<br>- **50 requests Google Login song song cùng 1 email**: Ghép nối tài khoản (Account Linking) idempotent an toàn, không sinh duplicate user. |
| `stress_benchmark.ts` | `bun run test:benchmark` | - **10.000 HTTP requests** tải nặng trên DB cô lập.<br>- Đo Throughput (RPS), Latency (p50, p95, p99), bảo toàn 0% lỗi và 0 lock database (`SQLITE_BUSY`). |

