// ======================
// MATCH SYNC (submits run results to the FastAPI service)
// ======================

import { apiFetch } from "../game/auth";

export interface MatchRecord {
    id: number;
    mode: string;
    score: number;
    wave: number;
    kills: number;
    survived: number;
    damage_dealt: number;
    result: "victory" | "defeat";
    coins_earned: number;
    xp_earned: number;
    created_at: string;
}

export interface MatchSubmitResult {
    match: MatchRecord;
    rewards: { xp: number; coins: number };
    stats: { level: number; xp: number; coins: number; high_score: number };
}

export interface MatchPayload {
    mode?: string;
    score: number;
    wave: number;
    kills: number;
    survived: number;
    damage_dealt: number;
    result: "victory" | "defeat";
}

// Records a finished run and returns the server-awarded rewards.
// Returns null when the API is unreachable or the session is invalid.
export async function submitMatch(payload: MatchPayload): Promise<MatchSubmitResult | null> {
    const res = await apiFetch("/api/matches", {
        method: "POST",
        body: JSON.stringify(payload)
    });

    if (!res || !res.ok) {
        return null;
    }

    return res.json();
}

// Fetches recent match history (newest first).
export async function fetchMatchHistory(limit = 20): Promise<MatchRecord[] | null> {
    const res = await apiFetch("/api/matches?limit=" + limit);

    if (!res || !res.ok) {
        return null;
    }

    return res.json();
}