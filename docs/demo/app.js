/**
 * AuthService Integration Demo (Plain JavaScript)
 * Tập trung tối đa vào mã tích hợp Client với RESTful API của AuthService.
 */

// 1. Cấu hình Endpoint
if (
  typeof window !== "undefined" &&
  window.location?.origin &&
  window.location.origin.startsWith("http")
) {
  const apiBaseInput = document.getElementById("apiBase");
  if (apiBaseInput && window.location.origin !== "null") {
    apiBaseInput.value = window.location.origin;
  }
}

const getApiBase = () => document.getElementById("apiBase").value.trim().replace(/\/$/, "");

// Lưu trạng thái phiên làm việc cục bộ
let currentTokens = {
  accessToken: null,
  refreshToken: null,
  user: null,
};

// Khởi tạo & Kiểm tra kết nối Health check
async function checkHealth() {
  const statusEl = document.getElementById("serverStatus");
  try {
    const res = await fetch(`${getApiBase()}/health`);
    if (res.ok) {
      statusEl.textContent = "● Đang hoạt động";
      statusEl.style.background = "#dcfce7";
      statusEl.style.color = "#15803d";
    } else {
      throw new Error("Không kết nối được");
    }
  } catch (err) {
    statusEl.textContent = "○ Không kết nối được API";
    statusEl.style.background = "#fee2e2";
    statusEl.style.color = "#b91c1c";
  }
}
checkHealth();
document.getElementById("apiBase")?.addEventListener("input", checkHealth);

// ============================================================================
// LUỒNG 1: MAGIC LINK (100% Passwordless)
// ============================================================================

/**
 * Bước 1.1: Gửi yêu cầu Magic Link
 * Endpoint: POST /api/v1/auth/magic-link/request
 */
document.getElementById("btnRequestMagicLink").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value.trim();
  const logBox = document.getElementById("magicLinkLog");

  logBox.textContent = `[Gửi Request] Đang gửi yêu cầu cho email: ${email}...`;

  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/magic-link`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    logBox.textContent = `[Phản hồi từ Server]:\n${JSON.stringify(data, null, 2)}`;

    // Trong môi trường Development, server trả kèm debugToken để kiểm thử trực tiếp
    if (data.debugToken) {
      document.getElementById("tokenInput").value = data.debugToken;
      logBox.textContent += `\n\n💡 [DEV MODE] Đã tự động điền Token vào ô xác thực bên dưới!`;
    }
  } catch (err) {
    logBox.textContent = `[Lỗi Kết Nối]: ${err.message}`;
  }
});

/**
 * Bước 1.2: Xác thực Magic Link Token
 * Endpoint: POST /api/v1/auth/magic-link/verify
 * LƯU Ý BẢO MẬT: Bắt buộc dùng POST (do Client gọi) để ngăn crawler của email đốt cháy token.
 */
document.getElementById("btnVerifyMagicLink").addEventListener("click", async () => {
  const token = document.getElementById("tokenInput").value.trim();
  const logBox = document.getElementById("magicLinkLog");

  if (!token) {
    alert("Vui lòng nhập token xác thực!");
    return;
  }

  logBox.textContent = `[Xác Thực] Đang gửi token lên server...`;

  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/magic-link/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        deviceInfo: {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      }),
    });

    const data = await res.json();
    logBox.textContent = `[Kết quả xác thực]:\n${JSON.stringify(data, null, 2)}`;

    if (res.ok && data.accessToken) {
      handleLoginSuccess(data);
    } else {
      alert(`Xác thực thất bại: ${data.message || data.code}`);
    }
  } catch (err) {
    logBox.textContent = `[Lỗi]: ${err.message}`;
  }
});

// ============================================================================
// LUỒNG 2: GOOGLE OAUTH 2.1 (Account Linking Idempotent)
// ============================================================================

/**
 * Endpoint: POST /api/v1/oauth/google
 * Client lấy Google ID Token và chuyển lên AuthService.
 * AuthService tự động map về User ID cũ nếu email trùng khớp.
 */
document.getElementById("btnMockGoogleLogin").addEventListener("click", async () => {
  const email = document.getElementById("oauthEmail").value.trim();
  const logBox = document.getElementById("oauthLog");

  logBox.textContent = `[Google OAuth] Đang gửi ID Token giả lập cho ${email}...`;

  try {
    // Giả lập chuỗi mock id_token theo chuẩn unit test của authservice
    const mockIdToken = `mock:${email}:google_uid_demo_12345`;

    const res = await fetch(`${getApiBase()}/api/v1/auth/oauth/google`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: mockIdToken,
        deviceInfo: { browser: "Demo Browser" },
      }),
    });

    const data = await res.json();
    logBox.textContent = `[Kết quả Google Login & Account Linking]:\n${JSON.stringify(data, null, 2)}`;

    if (res.ok && data.accessToken) {
      handleLoginSuccess(data);
    }
  } catch (err) {
    logBox.textContent = `[Lỗi]: ${err.message}`;
  }
});

// ============================================================================
// QUẢN LÝ PHIÊN, ACCESS TOKEN & REFRESH TOKEN (RTR)
// ============================================================================

function handleLoginSuccess(authData) {
  currentTokens.accessToken = authData.accessToken;
  currentTokens.refreshToken = authData.refreshToken;
  currentTokens.user = authData.user;

  // Hiển thị phần thông tin phiên
  document.getElementById("sessionSection").style.display = "block";
  document.getElementById("userId").textContent = authData.user.id;
  document.getElementById("userEmail").textContent = authData.user.email;
  document.getElementById("userRoles").textContent = JSON.stringify(authData.user.roles);
  document.getElementById("isNewUser").textContent = authData.isNewUser
    ? "Có (Tạo mới)"
    : "Không (Tài khoản cũ)";

  document.getElementById("accessTokenDisplay").value = authData.accessToken;
  document.getElementById("refreshTokenDisplay").value = authData.refreshToken;

  document.getElementById("sessionLog").textContent =
    "Đăng nhập thành công! Token đã sẵn sàng sử dụng.";
  document.getElementById("sessionSection").scrollIntoView({ behavior: "smooth" });
}

/**
 * Gọi Protected API: Xem danh sách các phiên đang hoạt động
 * Endpoint: GET /api/v1/sessions (Bearer Token)
 */
document.getElementById("btnGetSessions").addEventListener("click", async () => {
  const logBox = document.getElementById("sessionLog");
  if (!currentTokens.accessToken) return;

  logBox.textContent = "Đang gọi GET /api/v1/sessions với Access Token Bearer...";

  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/sessions`, {
      headers: {
        Authorization: `Bearer ${currentTokens.accessToken}`,
      },
    });

    const data = await res.json();
    logBox.textContent = `[Danh sách Sessions]:\n${JSON.stringify(data, null, 2)}`;
  } catch (err) {
    logBox.textContent = `[Lỗi]: ${err.message}`;
  }
});

/**
 * Xoay vòng Refresh Token (Token Rotation - RTR)
 * Endpoint: POST /api/v1/auth/refresh
 */
document.getElementById("btnRefreshToken").addEventListener("click", async () => {
  const logBox = document.getElementById("sessionLog");
  if (!currentTokens.refreshToken) return;

  logBox.textContent = "Đang gửi Refresh Token cũ để lấy cặp Token mới (RTR)...";

  try {
    const res = await fetch(`${getApiBase()}/api/v1/auth/token/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        refreshToken: currentTokens.refreshToken,
      }),
    });

    const data = await res.json();
    logBox.textContent = `[Kết quả Refresh]:\n${JSON.stringify(data, null, 2)}`;

    if (res.ok && data.accessToken) {
      currentTokens.accessToken = data.accessToken;
      currentTokens.refreshToken = data.refreshToken;
      document.getElementById("accessTokenDisplay").value = data.accessToken;
      document.getElementById("refreshTokenDisplay").value = data.refreshToken;
      logBox.textContent +=
        "\n\n✅ Đã xoay vòng Refresh Token thành công (Token cũ đã bị thu hồi)!";
    }
  } catch (err) {
    logBox.textContent = `[Lỗi]: ${err.message}`;
  }
});

/**
 * Đăng xuất: Thu hồi Refresh Token
 * Endpoint: POST /api/v1/auth/logout
 */
document.getElementById("btnLogout").addEventListener("click", async () => {
  if (!currentTokens.refreshToken) return;

  try {
    await fetch(`${getApiBase()}/api/v1/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: currentTokens.refreshToken }),
    });

    alert("Đã đăng xuất thành công!");
    currentTokens = { accessToken: null, refreshToken: null, user: null };
    document.getElementById("sessionSection").style.display = "none";
    document.getElementById("tokenInput").value = "";
    document.getElementById("magicLinkLog").textContent = "Đã đăng xuất.";
  } catch (err) {
    alert(`Lỗi đăng xuất: ${err.message}`);
  }
});
