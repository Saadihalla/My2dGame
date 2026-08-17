import { useEffect, useState } from "react";
import { currentPlayer, AUTH_EVENT, type PlayerProfile } from "../game/auth";

// Subscribes the component to session changes (login / logout / restore).
export function useAuth(): PlayerProfile | null {
    const [player, setPlayer] = useState<PlayerProfile | null>(currentPlayer);

    useEffect(() => {
        function onChange() {
            setPlayer(currentPlayer);
        }

        window.addEventListener(AUTH_EVENT, onChange);
        return () => window.removeEventListener(AUTH_EVENT, onChange);
    }, []);

    return player;
}