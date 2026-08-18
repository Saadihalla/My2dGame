import { useEffect, useState } from "react";
import {
    createLobby,
    joinLobby,
    leaveLobby,
    leaveGameRoom,
    setReady,
    startGame,
    isHost
} from "../net/client";
import { useNet } from "../hooks/useNet";
import { currentPlayer } from "../game/auth";

// Lobby overlay: create/join a private room, ready-up, host start.
export default function LobbyPanel() {
    const net = useNet();
    const [roomCode, setRoomCode] = useState("");
    const [mode, setMode] = useState<"menu" | "create" | "join">("menu");
    const [busy, setBusy] = useState(false);
    const [username, setUsername] = useState(currentPlayer?.username || "Hero");

    const inRoom = net.status === "lobby" || net.status === "starting";
    const me = net.players.find(p => p.sessionId === net.sessionId);
    const myReady = me ? me.ready : false;
    const host = isHost();

    useEffect(() => {
        if (net.status === "lobby" || net.status === "starting") {
            setBusy(false);
        }
    }, [net.status]);

    async function handleCreate() {
        setBusy(true);
        await createLobby(username.trim() || "Hero");
    }

    async function handleJoin() {
        const code = roomCode.trim();
        if (!code) {
            return;
        }
        setBusy(true);
        await joinLobby(code, username.trim() || "Hero");
    }

    function copyInvite() {
        const url = `${window.location.origin}${window.location.pathname}#room=${net.roomId}`;
        navigator.clipboard?.writeText(url).catch(() => {});
    }

    return (
        <div className="lobby-backdrop">
            <div className="lobby-panel">
                <div className="lobby-header">
                    <h2>ONLINE LOBBY</h2>
                    <button className="lobby-close" onClick={() => leaveLobby()}>✕</button>
                </div>

                {net.error && <p className="lobby-error">{net.error}</p>}

                {!inRoom && (
                    <>
                        {mode === "menu" && (
                            <div className="lobby-menu">
                                <label className="lobby-label">
                                    PLAYER NAME
                                    <input
                                        type="text"
                                        maxLength={16}
                                        value={username}
                                        onChange={e => setUsername(e.target.value)}
                                    />
                                </label>
                                <button
                                    className="lobby-btn primary"
                                    disabled={busy}
                                    onClick={() => setMode("create")}
                                >
                                    CREATE ROOM
                                </button>
                                <button
                                    className="lobby-btn"
                                    disabled={busy}
                                    onClick={() => setMode("join")}
                                >
                                    JOIN ROOM
                                </button>
                            </div>
                        )}

                        {mode === "create" && (
                            <div className="lobby-menu">
                                <p className="lobby-hint">
                                    Create a private room and share the code with friends.
                                </p>
                                <button
                                    className="lobby-btn primary"
                                    disabled={busy}
                                    onClick={handleCreate}
                                >
                                    {busy ? "CONNECTING..." : "HOST ROOM"}
                                </button>
                                <button
                                    className="lobby-btn"
                                    disabled={busy}
                                    onClick={() => setMode("menu")}
                                >
                                    BACK
                                </button>
                            </div>
                        )}

                        {mode === "join" && (
                            <div className="lobby-menu">
                                <label className="lobby-label">
                                    ROOM CODE
                                    <input
                                        type="text"
                                        maxLength={24}
                                        value={roomCode}
                                        placeholder="e.g. abc123"
                                        onChange={e => setRoomCode(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === "Enter") {
                                                handleJoin();
                                            }
                                        }}
                                    />
                                </label>
                                <button
                                    className="lobby-btn primary"
                                    disabled={busy || !roomCode.trim()}
                                    onClick={handleJoin}
                                >
                                    {busy ? "CONNECTING..." : "JOIN"}
                                </button>
                                <button
                                    className="lobby-btn"
                                    disabled={busy}
                                    onClick={() => setMode("menu")}
                                >
                                    BACK
                                </button>
                            </div>
                        )}
                    </>
                )}

                {inRoom && (
                    <div className="lobby-room">
                        <div className="lobby-code-row">
                            <span className="lobby-code">{net.roomId}</span>
                            <button className="lobby-btn small" onClick={copyInvite}>
                                COPY INVITE
                            </button>
                        </div>
                        <p className="lobby-hint">
                            Share this code — friends join from the title screen.
                        </p>

                        <ul className="lobby-players">
                            {net.players.map(p => (
                                <li
                                    key={p.sessionId}
                                    className={
                                        "lobby-player" +
                                        (p.isHost ? " host" : "") +
                                        (p.ready ? " ready" : "")
                                    }
                                >
                                    <span className="lobby-player-name">{p.username}</span>
                                    {p.isHost && <span className="lobby-player-tag">HOST</span>}
                                    <span className="lobby-player-ready">
                                        {p.ready ? "READY" : "NOT READY"}
                                    </span>
                                </li>
                            ))}
                        </ul>

                        <div className="lobby-actions">
                            {!host && (
                                <button
                                    className="lobby-btn primary"
                                    onClick={() => setReady(!myReady)}
                                >
                                    {myReady ? "UNREADY" : "READY"}
                                </button>
                            )}
                            {host && (
                                <button
                                    className="lobby-btn primary"
                                    disabled={
                                        net.players.length < 2 ||
                                        !net.players.every(p => p.ready)
                                    }
                                    onClick={() => startGame()}
                                >
                                    START MATCH
                                </button>
                            )}
                            <button className="lobby-btn" onClick={() => leaveLobby()}>
                                LEAVE
                            </button>
                        </div>

                        {net.status === "starting" && (
                            <p className="lobby-starting">STARTING MATCH...</p>
                        )}
                    </div>
                )}

                {net.status === "ingame" && (
                    <div className="lobby-inmatch">
                        <p className="lobby-starting">IN MATCH</p>
                        <p className="lobby-hint">
                            Match is live on the server — state syncs from the game room.
                        </p>
                        <button className="lobby-btn" onClick={() => leaveGameRoom()}>
                            LEAVE MATCH
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}