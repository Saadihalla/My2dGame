# ======================
# REWARD FORMULAS (server-side, never trusted from the client)
# Mirrors the game's own XP curve (xpNext = 40 + level * 25).
# ======================

LEVEL_XP_BASE = 40
LEVEL_XP_GROWTH = 25


def compute_rewards(score: int, wave: int, result: str) -> tuple[int, int]:
    xp = score // 10 + wave * 5 + (50 if result == "victory" else 0)
    coins = score // 25 + (20 if result == "victory" else 5)
    return xp, coins


def level_from_xp(total_xp: int) -> int:
    level = 1
    remaining = total_xp

    while remaining >= LEVEL_XP_BASE + level * LEVEL_XP_GROWTH:
        remaining -= LEVEL_XP_BASE + level * LEVEL_XP_GROWTH
        level += 1

    return level


def xp_into_current_level(total_xp: int) -> int:
    """XP progress inside the current level (0..threshold), for UI bars."""
    level = 1
    remaining = total_xp

    while remaining >= LEVEL_XP_BASE + level * LEVEL_XP_GROWTH:
        remaining -= LEVEL_XP_BASE + level * LEVEL_XP_GROWTH
        level += 1

    return remaining


def xp_for_level(level: int) -> int:
    return LEVEL_XP_BASE + level * LEVEL_XP_GROWTH