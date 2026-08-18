import { useEffect, useState } from "react";
import GameCanvas from "./components/GameCanvas";
import ProfilePanel from "./components/ProfilePanel";
import LobbyPanel from "./components/LobbyPanel";
import { useAuth } from "./hooks/useAuth";
import { useGameState } from "./hooks/useGameState";
import { joinLobby } from "./net/client";
import { currentPlayer } from "./game/auth";

export default function App() {
    const player = useAuth();
    const gameState = useGameState();
    const [profileOpen, setProfileOpen] = useState(false);
    const [lobbyOpen, setLobbyOpen] = useState(false);

    // Deep link support: my2d-game.vercel.app/#room=abc123 joins a lobby.
    useEffect(() => {
        const code = new URLSearchParams(window.location.hash.slice(1)).get("room");
        if (code) {
            const username = currentPlayer?.username || "Hero";
            joinLobby(code, username).then(ok => {
                if (ok) {
                    setLobbyOpen(true);
                }
            });
        }
    }, []);

    const showOnline = player && gameState === "title" && !lobbyOpen;

    return (
        <div className="game-container">

            <h1>⚔ DARK FANTASY ⚔</h1>

            <div className="canvas-wrapper">
                <GameCanvas />

                {player && gameState === "title" && (
                    <button
                        className="profile-button"
                        onClick={() => setProfileOpen(true)}
                    >
                        PROFILE · {player.username}
                    </button>
                )}

                {showOnline && (
                    <button
                        className="online-button"
                        onClick={() => setLobbyOpen(true)}
                    >
                        PLAY ONLINE
                    </button>
                )}
            </div>

            {profileOpen && player && (
                <ProfilePanel player={player} onClose={() => setProfileOpen(false)} />
            )}

            {lobbyOpen && (
                <LobbyPanel />
            )}

            <div className="controls">
                <div>
                    <span>W A S D</span> — Move
                </div>
                <div>
                    <span>SPACE</span> — Attack
                </div>
                <div>
                    <span>R</span> — Restart
                </div>
            </div>

        </div>
    );
}