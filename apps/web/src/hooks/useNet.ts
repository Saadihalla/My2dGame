import { useEffect, useState } from "react";
import { netState, NET_EVENT, type NetState } from "../net/client";

// Subscribes the component to game-server connection changes.
export function useNet(): NetState {
    const [state, setState] = useState<NetState>(netState);

    useEffect(() => {
        function onChange() {
            setState({ ...netState });
        }

        window.addEventListener(NET_EVENT, onChange);
        return () => window.removeEventListener(NET_EVENT, onChange);
    }, []);

    return state;
}