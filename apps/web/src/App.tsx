import GameCanvas from "./components/GameCanvas";

export default function App() {
    return (
        <div className="game-container">

            <h1>⚔ DARK FANTASY ⚔</h1>

            <div className="canvas-wrapper">
                <GameCanvas />
            </div>

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