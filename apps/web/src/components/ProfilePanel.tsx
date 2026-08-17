import { useCallback, useEffect, useState } from "react";
import { clearSession } from "../game/auth";
import { fetchMatchHistory, type MatchRecord } from "../api/matches";
import type { PlayerProfile } from "../game/auth";

// Mirrors the server's level curve: xpNeeded(level) = 40 + level * 25.
const LEVEL_XP_BASE = 40;
const LEVEL_XP_GROWTH = 25;

function xpProgress(totalXp: number, level: number): { current: number; needed: number } {
    let remaining = totalXp;
    for (let l = 1; l < level; l++) {
        remaining -= LEVEL_XP_BASE + l * LEVEL_XP_GROWTH;
    }
    return { current: Math.max(0, remaining), needed: LEVEL_XP_BASE + level * LEVEL_XP_GROWTH };
}

function timeAgo(iso: string): string {
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + "m ago";
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.floor(hours / 24);
    return days + "d ago";
}

interface ProfilePanelProps {
    player: PlayerProfile;
    onClose: () => void;
}

export default function ProfilePanel({ player, onClose }: ProfilePanelProps) {
    const [matches, setMatches] = useState<MatchRecord[] | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        const history = await fetchMatchHistory(20);
        setMatches(history);
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const stats = player.stats;
    const totalXp = stats?.xp || 0;
    const level = stats?.level || 1;
    const bar = xpProgress(totalXp, level);
    const progress = Math.min(1, bar.current / bar.needed);
    const wins = (matches || []).filter((m) => m.result === "victory").length;

    return (
        <div className="profile-backdrop" onClick={onClose}>
            <div className="profile-panel" onClick={(e) => e.stopPropagation()}>
                <div className="profile-header">
                    <h2>PROFILE</h2>
                    <button className="profile-close" onClick={onClose} aria-label="Close profile">✕</button>
                </div>

                <p className="profile-username">{player.username}</p>
                <p className="profile-id">ID: {player.id}</p>

                <div className="profile-stats">
                    <div className="profile-stat">
                        <span className="profile-stat-label">LEVEL</span>
                        <span className="profile-stat-value">{level}</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-label">COINS</span>
                        <span className="profile-stat-value">{stats?.coins || 0}</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-label">BEST SCORE</span>
                        <span className="profile-stat-value">{stats?.high_score || 0}</span>
                    </div>
                    <div className="profile-stat">
                        <span className="profile-stat-label">MATCHES</span>
                        <span className="profile-stat-value">{matches === null ? "—" : matches.length}</span>
                    </div>
                </div>

                <div className="profile-xp-row">
                    <div className="profile-xp-bar">
                        <div className="profile-xp-fill" style={{ width: (progress * 100).toFixed(1) + "%" }}></div>
                    </div>
                    <span className="profile-xp-text">
                        {bar.current} / {bar.needed} XP
                    </span>
                </div>

                <div className="profile-history">
                    <h3>RECENT MATCHES {matches !== null && <span>({wins} wins)</span>}</h3>

                    {loading && <p className="profile-empty">Loading…</p>}
                    {!loading && matches === null && (
                        <p className="profile-empty">Offline — match history unavailable.</p>
                    )}
                    {!loading && matches !== null && matches.length === 0 && (
                        <p className="profile-empty">No matches yet. Die gloriously.</p>
                    )}

                    {matches !== null && matches.length > 0 && (
                        <ul className="profile-match-list">
                            {matches.map((m) => (
                                <li key={m.id} className={"profile-match " + m.result}>
                                    <span className="profile-match-result">{m.result === "victory" ? "W" : "L"}</span>
                                    <span className="profile-match-score">{m.score}</span>
                                    <span className="profile-match-detail">wave {m.wave}</span>
                                    <span className="profile-match-detail">{m.kills} kills</span>
                                    <span className="profile-match-detail">{m.mode}</span>
                                    <span className="profile-match-reward">+{m.xp_earned} XP</span>
                                    <span className="profile-match-reward">+{m.coins_earned} <span className="profile-coin">◈</span></span>
                                    <span className="profile-match-time">{timeAgo(m.created_at)}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <button
                    className="profile-logout"
                    onClick={() => {
                        clearSession();
                        onClose();
                    }}
                >
                    LOGOUT
                </button>
            </div>
        </div>
    );
}