// ======================
// AUTHENTICATION (Hybrid API + LocalStorage Fallback for 100% Reliability)
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

function getLocalUsers() {
    try {
        return JSON.parse(localStorage.getItem("darkFantasyUsers") || "[]");
    } catch {
        return [];
    }
}

function saveLocalUsers(users) {
    try {
        localStorage.setItem("darkFantasyUsers", JSON.stringify(users));
    } catch {
        // ignore
    }
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
            <h2>BLACK SWORDSMAN ACCOUNT</h2>
            <div id="authUserInfo" style="display:none;">
                <p class="auth-text">Logged in as Guts' Ally:</p>
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

        if (!username || !password) {
            messageDiv.textContent = "Username and password are required.";
            messageDiv.style.color = "#ff6b6b";
            return;
        }

        messageDiv.textContent = "Logging in...";
        messageDiv.style.color = "#7ec8ff";

        let success = false;
        let playerData = null;
        let errorMsg = "";

        // Try API first
        try {
            const res = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                success = true;
                playerData = data.player;
            } else {
                errorMsg = data.message || "Invalid username or password.";
            }
        } catch {
            // API failed (offline / local dev) -> use local storage fallback
            const users = getLocalUsers();
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                success = true;
                playerData = {
                    id: user.id,
                    username: user.username,
                    stats: user.stats || { level: 1, xp: 0, coins: 0, high_score: 0 }
                };
            } else {
                errorMsg = "Invalid username or password.";
            }
        }

        if (success && playerData) {
            currentPlayer = playerData;
            localStorage.setItem("darkFantasyPlayer", JSON.stringify(currentPlayer));
            messageDiv.textContent = "Login successful! Welcome to the Eclipse.";
            messageDiv.style.color = "#7dff8a";
            updateAuthView();
        } else {
            messageDiv.textContent = errorMsg || "Login failed.";
            messageDiv.style.color = "#ff6b6b";
        }
    });

    document.getElementById("authRegisterBtn").addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            messageDiv.textContent = "Username and password are required.";
            messageDiv.style.color = "#ff6b6b";
            return;
        }
        if (username.length < 3 || username.length > 30) {
            messageDiv.textContent = "Username must be 3-30 chars.";
            messageDiv.style.color = "#ff6b6b";
            return;
        }
        if (password.length < 8) {
            messageDiv.textContent = "Password must be at least 8 chars.";
            messageDiv.style.color = "#ff6b6b";
            return;
        }

        messageDiv.textContent = "Creating account...";
        messageDiv.style.color = "#7ec8ff";

        let success = false;
        let errorMsg = "";

        // Try API first
        try {
            const res = await fetch("/api/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.success) {
                success = true;
            } else {
                errorMsg = data.message || "Registration failed.";
            }
        } catch {
            // API failed -> use local storage fallback
            const users = getLocalUsers();
            if (users.some(u => u.username === username)) {
                errorMsg = "Username already exists.";
            } else {
                const newId = "usr_" + Math.random().toString(36).substr(2, 9);
                users.push({
                    id: newId,
                    username,
                    password,
                    stats: { level: 1, xp: 0, coins: 0, high_score: 0 }
                });
                saveLocalUsers(users);
                success = true;
            }
        }

        if (success) {
            messageDiv.textContent = "Account created successfully! You can now log in.";
            messageDiv.style.color = "#7dff8a";
        } else {
            messageDiv.textContent = errorMsg || "Registration failed.";
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
