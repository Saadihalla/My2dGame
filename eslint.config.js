import js from "@eslint/js";
import globals from "globals";

export default [
    {
        ignores: ["dist/", "node_modules/"]
    },
    js.configs.recommended,
    {
        files: ["src/**/*.js", "tests/**/*.js", "api/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.es2022
            }
        },
        rules: {
            "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
        }
    },
    {
        files: ["tools/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        }
    }
];