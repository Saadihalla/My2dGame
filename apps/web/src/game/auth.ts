// ======================
// AUTHENTICATION (FastAPI + JWT, with LocalStorage fallback for local dev)
// ======================

// API base URL. Set VITE_API_URL to the deployed FastAPI service
// (e.g. https://api.your-game.up.railway.app). Empty = same origin.
const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || "";

export interface PlayerProfile {
    id: string;
    username: string;
    stats?: {
        level: number;
        xp: number;
        coins: number;
        high_score: number;
    } | null;
}

const ACCESS_KEY = "darkFantasyAccessToken";
const REFRESH_KEY = "darkFantasyRefreshToken";

export let currentPlayer: PlayerProfile | null = null;

try {
    const saved = localStorage.getItem("darkFantasyPlayer");
    if (saved) {
        currentPlayer = JSON.parse(saved);
    }
} catch {
    // localStorage unavailable
}

export function getAccessToken(): string | null {
    try {
        return localStorage.getItem(ACCESS_KEY);
    } catch {
        return null;
    }
}

export function getRefreshToken(): string | null {
    try {
        return localStorage.getItem(REFRESH_KEY);
    } catch {
        return null;
    }
}

function saveSession(player: PlayerProfile, accessToken?: string | null, refreshToken?: string | null) {
    currentPlayer = player;

    try {
        localStorage.setItem("darkFantasyPlayer", JSON.stringify(player));

        if (accessToken) {
            localStorage.setItem(ACCESS_KEY, accessToken);
        } else {
            localStorage.removeItem(ACCESS_KEY);
        }

        if (refreshToken) {
            localStorage.setItem(REFRESH_KEY, refreshToken);
        } else {
            localStorage.removeItem(REFRESH_KEY);
        }
    } catch {
        // storage unavailable — session lives for this page load only
    }
}

export function clearSession() {
    currentPlayer = null;

    try {
        localStorage.removeItem("darkFantasyPlayer");
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    } catch {
        // ignore
    }
}

// Wraps fetch so network failures become a null result instead of an
// exception (keeps the retry/fallback logic exception-free).
async function safeFetch(url: string, options: RequestInit): Promise<Response | null> {
    try {
        return await fetch(url, options);
    } catch {
        return null;
    }
}

// Fetches with the access token attached; on 401 it tries a refresh
// once and retries the request. Returns null when the API is unreachable.
async function apiFetch(path: string, options: RequestInit = {}): Promise<Response | null> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined)
    };

    const token = getAccessToken();
    if (token) {
        headers["Authorization"] = "Bearer " + token;
    }

    const response = await safeFetch(API_BASE + path, { ...options, headers });
    if (!response) {
        return null;
    }

    if (response.status === 401 && getRefreshToken() && !path.startsWith("/api/auth/")) {
        const refreshed = await tryRefresh();
        if (refreshed) {
            return safeFetch(API_BASE + path, {
                ...options,
                headers: { ...headers, Authorization: "Bearer " + getAccessToken() }
            });
        }
    }

    return response;
}

async function tryRefresh(): Promise<boolean> {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
        return false;
    }

    try {
        const res = await fetch(API_BASE + "/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!res.ok) {
            clearSession();
            return false;
        }

        const data = await res.json();
        if (data.access_token) {
            try {
                localStorage.setItem(ACCESS_KEY, data.access_token);
            } catch {
                // ignore
            }
            return true;
        }
    } catch {
        // API unreachable — keep the session but stay unauthenticated
    }

    return false;
}

// Restores the session at boot: validates the access token (or refreshes
// it) and re-fetches the profile. Safe to call before login UI exists.
export async function restoreSession(): Promise<void> {
    if (!getAccessToken() && !getRefreshToken()) {
        return;
    }

    const res = await apiFetch("/api/me");

    if (!res) {
        return;
    }

    if (res.ok) {
        const data = await res.json();
        if (data && data.player) {
            saveSession(data.player);
        }
    } else {
        clearSession();
    }
}

// ======================
// LOCAL FALLBACK (offline / local dev without the API)
// ======================

function getLocalUsers(): Array<{ id: string; username: string; password: string; stats: PlayerProfile["stats"] }> {
    try {
        return JSON.parse(localStorage.getItem("darkFantasyUsers") || "[]");
    } catch {
        return [];
    }
}

function saveLocalUsers(users: unknown) {
    try {
        localStorage.setItem("darkFantasyUsers", JSON.stringify(users));
    } catch {
        // ignore
    }
}

// ======================
// AUTH UI (kept canvas-era DOM for now; React shell takes over later)
// ======================

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

    const usernameInput = document.getElementById("authUsernameInput") as HTMLInputElement;
    const passwordInput = document.getElementById("authPasswordInput") as HTMLInputElement;
    const messageDiv = document.getElementById("authMessage") as HTMLElement;
    const userInfoDiv = document.getElementById("authUserInfo") as HTMLElement;
    const formSection = document.getElementById("authFormSection") as HTMLElement;
    const usernameDisplay = document.getElementById("authUsernameDisplay") as HTMLElement;
    const idDisplay = document.getElementById("authIdDisplay") as HTMLElement;

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

    function setMessage(text: string, color: string) {
        messageDiv.textContent = text;
        messageDiv.style.color = color;
    }

    document.getElementById("authLoginBtn").addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            setMessage("Username and password are required.", "#ff6b6b");
            return;
        }

        setMessage("Logging in...", "#7ec8ff");

        let success = false;
        let playerData: PlayerProfile | null = null;
        let errorMsg = "";

        try {
            const res = await fetch(API_BASE + "/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok && data.access_token) {
                success = true;
                playerData = data.player;
                saveSession(playerData, data.access_token, data.refresh_token);
            } else {
                errorMsg = data.detail || data.message || "Invalid username or password.";
            }
        } catch {
            // API unreachable (offline / local dev) -> local storage fallback
            const users = getLocalUsers();
            const user = users.find(u => u.username === username && u.password === password);
            if (user) {
                success = true;
                playerData = {
                    id: user.id,
                    username: user.username,
                    stats: user.stats || { level: 1, xp: 0, coins: 0, high_score: 0 }
                };
                saveSession(playerData);
            } else {
                errorMsg = "Invalid username or password.";
            }
        }

        if (success && playerData) {
            setMessage("Login successful! Welcome to the Eclipse.", "#7dff8a");
        } else {
            setMessage(errorMsg || "Login failed.", "#ff6b6b");
        }
        updateAuthView();
    });

    document.getElementById("authRegisterBtn").addEventListener("click", async () => {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
            setMessage("Username and password are required.", "#ff6b6b");
            return;
        }
        if (username.length < 3 || username.length > 30) {
            setMessage("Username must be 3-30 chars.", "#ff6b6b");
            return;
        }
        if (password.length < 8) {
            setMessage("Password must be at least 8 chars.", "#ff6b6b");
            return;
        }

        setMessage("Creating account...", "#7ec8ff");

        let success = false;
        let errorMsg = "";

        try {
            const res = await fetch(API_BASE + "/api/auth/register", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (res.ok) {
                success = true;
            } else {
                errorMsg = data.detail || data.message || "Registration failed.";
            }
        } catch {
            // API unreachable -> local storage fallback
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

        setMessage(
            success ? "Account created successfully! You can now log in." : errorMsg || "Registration failed.",
            success ? "#7dff8a" : "#ff6b6b"
        );
    });

    document.getElementById("authLogoutBtn").addEventListener("click", () => {
        clearSession();
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