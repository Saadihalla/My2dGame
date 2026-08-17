from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Player, PlayerStats
from ..routers.auth import _authenticate, _player_response
from ..schemas import PlayerResponse, PlayerStatsResponse, StatsUpdate

router = APIRouter(prefix="/api", tags=["players"])


@router.get("/me", response_model=PlayerResponse)
async def me(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    player_id = _authenticate(authorization)
    player = await session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")
    return await _player_response(session, player)


@router.post("/me/stats", response_model=PlayerStatsResponse)
async def update_stats(
    body: StatsUpdate,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    player_id = _authenticate(authorization)

    stats = await session.get(PlayerStats, player_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats not found.")

    if body.level is not None:
        stats.level = max(1, body.level)
    if body.xp is not None:
        stats.xp = max(0, body.xp)
    if body.coins is not None:
        stats.coins = max(0, body.coins)
    if body.high_score is not None:
        stats.high_score = max(stats.high_score, body.high_score)

    await session.commit()

    return PlayerStatsResponse(level=stats.level, xp=stats.xp, coins=stats.coins, high_score=stats.high_score)