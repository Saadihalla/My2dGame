import { defineConfig } from "@playwright/test";

// Browser E2E for the web game. Spawns the game server (with the debug
// channel enabled) and the Vite dev server, then runs the specs.
export default defineConfig({
    testDir: "./e2e",
    timeout: 420000,
    expect: { timeout: 15000 },
    fullyParallel: false,
    workers: 1,
    reporter: [["list"]],
    use: {
        baseURL: "http://localhost:5173",
        trace: "retain-on-failure"
    },
    webServer: [
        {
            command: "pnpm --filter @dark-fantasy/game exec tsx src/index.ts",
            cwd: "../../",
            env: { GAME_DEBUG: "1", PORT: "2567" },
            url: "http://localhost:2567/",
            timeout: 60000,
            reuseExistingServer: !process.env.CI
        },
        {
            command: "pnpm --filter @dark-fantasy/web exec vite --port 5173 --strictPort",
            cwd: "../../",
            url: "http://localhost:5173",
            timeout: 60000,
            reuseExistingServer: !process.env.CI
        }
    ]
});