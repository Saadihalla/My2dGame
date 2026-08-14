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

        // Validate input
        if (!username || !password) {
            return response.status(400).json({
                success: false,
                message: "Username and password are required."
            });
        }

        if (username.length < 3 || username.length > 30) {
            return response.status(400).json({
                success: false,
                message: "Username must be between 3 and 30 characters."
            });
        }

        if (password.length < 8) {
            return response.status(400).json({
                success: false,
                message: "Password must be at least 8 characters."
            });
        }

        const sql = neon(process.env.DATABASE_URL);

        // Check if username already exists
        const existingPlayer = await sql`
            SELECT id
            FROM players
            WHERE username = ${username}
        `;

        if (existingPlayer.length > 0) {
            return response.status(409).json({
                success: false,
                message: "Username already exists."
            });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 12);

        // Create player
        const player = await sql`
            INSERT INTO players (username, password_hash)
            VALUES (${username}, ${passwordHash})
            RETURNING id, username, created_at
        `;

        // Create default stats
        await sql`
            INSERT INTO player_stats (player_id)
            VALUES (${player[0].id})
        `;

        return response.status(201).json({
            success: true,
            message: "Account created successfully!",
            player: player[0]
        });

    } catch (error) {
        console.error("Registration error:", error);

        return response.status(500).json({
            success: false,
            message: "Something went wrong."
        });
    }
}