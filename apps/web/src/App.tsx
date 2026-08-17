import { useState } from "react";
import GameCanvas from "./components/GameCanvas";
import ProfilePanel from "./components/ProfilePanel";
import { useAuth } from "./hooks/useAuth";
import { useGameState } from "./hooks/useGameState";

export default function App() {
    const player = useAuth();
    const gameState = useGameState();
    const [profileOpen, setProfileOpen] = useState(false);

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
            </div>

            {profileOpen && player && (
                <ProfilePanel player={player} onClose={() => setProfileOpen(false)} />
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