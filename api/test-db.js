import { neon } from "@neondatabase/serverless";

export default async function handler(request, response) {
    try {
        const sql = neon(process.env.DATABASE_URL);

        const result = await sql`
            SELECT NOW() AS current_time
        `;

        response.status(200).json({
            success: true,
            message: "Database connection works!",
            time: result[0].current_time
        });
    } catch (error) {
        console.error("Database error:", error);

        response.status(500).json({
            success: false,
            message: "Database connection failed."
        });
    }
}