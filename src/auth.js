// ======================
// AUTHENTICATION (Login / Register & Player Session)
// ======================

export let currentPlayer = null;

try {
    const saved = localStorage.getItem("darkFantasyPlayer");
    if (saved) {
        currentPlayer = JSON.parse(saved);
    }
} catch {
    // localStorage unavailable
}

export function initAuthUI() {
    if (document.getElementById("authModal")) {
        return;
    }

    const modal = document.createElement("div");
    modal.id = "authModal";
    modal.className = "auth-modal";
    modal.style.display = "none";
    modal.innerHTML = `
        <div class="auth-content">
            <h2>PLAYER ACCOUNT</h2>
            <div id="authUserInfo" style="display:none;">
                <p class="auth-text">Logged in as:</p>
                <p id="authUsernameDisplay" class="auth-highlight"></p>
                <p class="auth-text" style="font-size:7px; color:#888; margin-top:4px;">ID: <span id="authIdDisplay"></span></p>
                <button id="authLogoutBtn" class="auth-btn" style="margin-top:16px;">LOGOUT</button>
            </div>
            <div id="authFormSection">
                <div class="auth-group">
                    <label>USERNAME (3-30 chars)</label>
                    <input type="text" id="authUsernameInput" maxlength="30" autocomplete="username">
                </div>
                <div class="auth-group">
                    <label>PASSWORD (min 8 chars)</label>
                    <input type="password" id="authPasswordInput" autocomplete="current-password">
                </div>
                <div id="authMessage" class="auth-message"></div>
                <div class="auth-buttons">
                    <button id="authLoginBtn" class="auth-btn">LOGIN</button>
                    <button id="authRegisterBtn" class="auth-btn">REGISTER</button>
                </div>
            </div>
            <button id="authCloseBtn" class="auth-close-btn">CLOSE</button>
        </div>
    `;
    document.body.appendChild(modal);

    const usernameInput = document.getElementById("authUsernameInput");
    const passwordInput = document.getElementById("authPasswordInput");
    const messageDiv = document.getElementById("authMessage");
    const userInfoDiv = document.getElementById("authUserInfo");
    const formSection = document.getElementById("authFormSection");
    const usernameDisplay = document.getElementById("authUsernameDisplay");
    const idDisplay = document.getElementById("authIdDisplay");

    function updateAuthView() {
        if (currentPlayer) {
            userInfoDiv.style.display = "block";
            formSection.style.display = "none";
            usernameDisplay.textContent = currentPlayer.username;
            idDisplay.textContent = currentPlayer.id;
        } else {
            userInfoDiv.style.display = "none";
            formSection.style.display = "block";
            usernameInput.value = "";
            passwordInput.value = "";
            messageDiv.textContent = "";
        }
    }

    updateAuthView();

    document.getElementById("authLoginBtn").addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        messageDiv.textContent = "Logging in...";
        messageDiv.style.color = "#7ec8ff";

        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                currentPlayer = data.player;
                localStorage.setItem("darkFantasyPlayer", JSON.stringify(currentPlayer));
                messageDiv.textContent = data.message;
                messageDiv.style.color = "#7dff8a";
                updateAuthView();
            } else {
                messageDiv.textContent = data.message || "Login failed.";
                messageDiv.style.color = "#ff6b6b";
            }
        } catch {
            messageDiv.textContent = "Network error or server unavailable.";
            messageDiv.style.color = "#ff6b6b";
        }
    });

    document.getElementById("authRegisterBtn").addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        messageDiv.textContent = "Creating account...";
        messageDiv.style.color = "#7ec8ff";

        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                messageDiv.textContent = data.message + " You can now login!";
                messageDiv.style.color = "#7dff8a";
            } else {
                messageDiv.textContent = data.message || "Registration failed.";
                messageDiv.style.color = "#ff6b6b";
            }
        } catch {
            messageDiv.textContent = "Network error or server unavailable.";
            messageDiv.style.color = "#ff6b6b";
        }
    });

    document.getElementById("authLogoutBtn").addEventListener("click", () => {
        currentPlayer = null;
        localStorage.removeItem("darkFantasyPlayer");
        updateAuthView();
    });

    document.getElementById("authCloseBtn").addEventListener("click", () => {
        modal.style.display = "none";
    });
}

export function openAuthModal() {
    const modal = document.getElementById("authModal");
    if (modal) {
        modal.style.display = "flex";
    }
}
