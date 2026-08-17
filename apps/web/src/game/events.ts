// ======================
// FLOW EVENTS
// Breaks import cycles: input/entities need to trigger game-flow
// actions without importing the flow module itself.
// ======================

export interface FlowHandlers {
    startGame: () => void;
    restartGame: () => void;
    togglePause: () => void;
    playerDeath: () => void;
    levelUp: () => void;
    levelUpChoice: (index: number) => void;
}

let handlers: FlowHandlers | null = null;

export function registerFlow(next: FlowHandlers) {
    handlers = next;
}

export function triggerStartGame() {
    if (handlers) {
        handlers.startGame();
    }
}

export function triggerRestartGame() {
    if (handlers) {
        handlers.restartGame();
    }
}

export function triggerTogglePause() {
    if (handlers) {
        handlers.togglePause();
    }
}

export function triggerPlayerDeath() {
    if (handlers) {
        handlers.playerDeath();
    }
}

export function triggerLevelUp() {
    if (handlers) {
        handlers.levelUp();
    }
}

export function triggerLevelUpChoice(index: number) {
    if (handlers) {
        handlers.levelUpChoice(index);
    }
}