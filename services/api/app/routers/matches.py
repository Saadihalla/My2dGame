from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import MatchHistory, PlayerStats
from ..rewards import compute_rewards, level_from_xp
from ..routers.auth import _authenticate
from ..schemas import MatchResponse, MatchSubmit, MatchSubmitResponse, PlayerStatsResponse

router = APIRouter(prefix="/api", tags=["matches"])


def _match_response(m: MatchHistory) -> MatchResponse:
    return MatchResponse(
        id=m.id,
        mode=m.mode,
        score=m.score,
        wave=m.wave,
        kills=m.kills,
        survived=m.survived,
        damage_dealt=m.damage_dealt,
        result=m.result,
        coins_earned=m.coins_earned,
        xp_earned=m.xp_earned,
        created_at=m.created_at,
    )


@router.post("/matches", response_model=MatchSubmitResponse, status_code=201)
async def submit_match(
    body: MatchSubmit,
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_session),
):
    player_id = _authenticate(authorization)

    stats = await session.get(PlayerStats, player_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Stats not found.")

    xp_earned, coins_earned = compute_rewards(body.score, body.wave, body.result)

    match = MatchHistory(
        player_id=player_id,
        mode=body.mode,
        score=body.score,
        wave=body.wave,
        kills=body.kills,
        survived=body.survived,
        damage_dealt=body.damage_dealt,
        result=body.result,
        coins_earned=coins_earned,
        xp_earned=xp_earned,
    )
    session.add(match)

    # Server-side stat updates: XP and coins are earned, never set.
    stats.xp += xp_earned
    stats.coins += coins_earned
    stats.level = level_from_xp(stats.xp)
    stats.high_score = max(stats.high_score, body.score)

    await session.commit()
    await session.refresh(match)

    return MatchSubmitResponse(
        match=_match_response(match),
        rewards={"xp": xp_earned, "coins": coins_earned},
        stats=PlayerStatsResponse(
            level=stats.level,
            xp=stats.xp,
            coins=stats.coins,
            high_score=stats.high_score,
        ),
    )


@router.get("/matches", response_model=list[MatchResponse])
async def match_history(
    authorization: str | None = Header(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    player_id = _authenticate(authorization)

    rows = await session.scalars(
        select(MatchHistory)
        .where(MatchHistory.player_id == player_id)
        .order_by(MatchHistory.created_at.desc())
        .limit(limit)
    )

    return [_match_response(m) for m in rows]