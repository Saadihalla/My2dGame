import { useEffect, useState } from "react";
import { gameState, STATE_EVENT, type GameState } from "../game/state";

// Subscribes the component to game-state changes (title/playing/...).
export function useGameState(): GameState {
    const [state, setState] = useState<GameState>(gameState);

    useEffect(() => {
        function onChange() {
            setState(gameState);
        }

        window.addEventListener(STATE_EVENT, onChange);
        return () => window.removeEventListener(STATE_EVENT, onChange);
    }, []);

    return state;
}