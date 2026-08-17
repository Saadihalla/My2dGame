from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_session
from ..models import Player, PlayerStats, RefreshToken
from ..schemas import LoginRequest, PlayerResponse, PlayerStatsResponse, RefreshRequest, RegisterRequest, TokenResponse
from ..security import (
    create_access_token,
    decode_access_token,
    generate_refresh_token,
    hash_password,
    hash_refresh_token,
    refresh_token_expiry,
    verify_password,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


async def _get_player_stats(session: AsyncSession, player_id: int) -> PlayerStatsResponse | None:
    stats = await session.get(PlayerStats, player_id)
    if not stats:
        return None
    return PlayerStatsResponse(level=stats.level, xp=stats.xp, coins=stats.coins, high_score=stats.high_score)


async def _player_response(session: AsyncSession, player: Player) -> PlayerResponse:
    return PlayerResponse(
        id=player.id,
        username=player.username,
        stats=await _get_player_stats(session, player.id),
    )


async def _require_player(session: AsyncSession, player_id: int) -> Player:
    player = await session.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found.")
    return player


async def _issue_tokens(session: AsyncSession, player_id: int) -> tuple[str, str]:
    access_token = create_access_token(player_id)
    refresh_token = generate_refresh_token()

    session.add(
        RefreshToken(
            player_id=player_id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=refresh_token_expiry(),
        )
    )

    return access_token, refresh_token


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, session: AsyncSession = Depends(get_session)):
    existing = await session.scalar(select(Player).where(Player.username == body.username))
    if existing:
        raise HTTPException(status_code=409, detail="Username already exists.")

    player = Player(username=body.username, password_hash=hash_password(body.password))
    session.add(player)
    await session.flush()

    session.add(PlayerStats(player_id=player.id))

    access_token, refresh_token = await _issue_tokens(session, player.id)
    await session.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        player=await _player_response(session, player),
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, session: AsyncSession = Depends(get_session)):
    player = await session.scalar(select(Player).where(Player.username == body.username))
    if not player or not verify_password(body.password, player.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    access_token, refresh_token = await _issue_tokens(session, player.id)
    await session.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        player=await _player_response(session, player),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(body: RefreshRequest, session: AsyncSession = Depends(get_session)):
    token_hash = hash_refresh_token(body.refresh_token)

    row = await session.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.expires_at > datetime.now(timezone.utc),
        )
    )

    if not row:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    # Rotation: the old token dies, a new one is issued.
    player_id = row.player_id
    await session.execute(delete(RefreshToken).where(RefreshToken.id == row.id))

    access_token, refresh_token = await _issue_tokens(session, player_id)
    await session.commit()

    player = await _require_player(session, player_id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        player=await _player_response(session, player),
    )


def _authenticate(authorization: str | None) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated.")
    player_id = decode_access_token(authorization[7:])
    if player_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")
    return player_id