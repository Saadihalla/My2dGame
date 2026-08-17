import { useEffect, useRef } from "react";

// Mounts the canvas + overlay controls the game engine expects, then
// boots the game module exactly once. The game module binds all its
// own listeners, so this stays a dumb host component for now — the
// React UI shell (menus, lobby, friends) layers on top in later phases.
export default function GameCanvas() {
    const bootedRef = useRef(false);

    useEffect(() => {
        if (bootedRef.current) {
            return;
        }
        bootedRef.current = true;

        import("../game/game").catch(function (err) {
            console.error("Failed to boot game:", err);
        });
    }, []);

    return (
        <>
            <canvas id="gameCanvas"></canvas>

            <button id="refreshButton" aria-label="Restart">↻</button>

            <button id="pauseButton" aria-label="Pause">❚❚</button>

            {/* MOBILE CONTROLS */}
            <div id="mobileControls">
                <div id="joystick">
                    <div id="joystickKnob"></div>
                </div>

                <button id="dashButton" aria-label="Dash">»</button>

                <button id="attackButton" aria-label="Attack">⚔</button>
            </div>
        </>
    );
}