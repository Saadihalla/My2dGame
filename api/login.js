import { neon } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";

export default async function handler(request, response) {
    if (request.method !== "POST") {
        return response.status(405).json({
            success: false,
            message: "Method not allowed"
        });
    }

    try {
        const { username, password } = request.body;

        // Check that both fields exist
        if (!username || !password) {
            return response.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        // Find the player
        const players = await sql`
            SELECT id, username, password_hash
            FROM players
            WHERE username = ${username}
        `;

        // Username doesn't exist
        if (players.length === 0) {
            return response.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        const player = players[0];

        // Check password
        const passwordCorrect = await bcrypt.compare(
            password,
            player.password_hash
        );

        if (!passwordCorrect) {
            return response.status(401).json({
                success: false,
                message: "Invalid username or password."
            });
        }

        // Get player's stats
        const stats = await sql`
            SELECT level, xp, coins, high_score
            FROM player_stats
            WHERE player_id = ${player.id}
        `;

        return response.status(200).json({
            success: true,
            message: "Login successful!",
            player: {
                id: player.id,
                username: player.username,
                stats: stats[0] || null
            }
        });

    } catch (error) {
        console.error("Login error:", error);

        return response.status(500).json({
            success: false,
            message: "Something went wrong."
        });
    }
}