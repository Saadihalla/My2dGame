from datetime import datetime

from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class StatsUpdate(BaseModel):
    level: int | None = None
    xp: int | None = None
    coins: int | None = None
    high_score: int | None = None


class PlayerStatsResponse(BaseModel):
    level: int
    xp: int
    coins: int
    high_score: int


class MatchSubmit(BaseModel):
    mode: str = Field(default="solo", max_length=20)
    score: int = Field(ge=0)
    wave: int = Field(default=1, ge=1)
    kills: int = Field(default=0, ge=0)
    survived: int = Field(default=0, ge=0)
    damage_dealt: int = Field(default=0, ge=0)
    result: str = Field(default="defeat", pattern="^(victory|defeat)$")


class MatchResponse(BaseModel):
    id: int
    mode: str
    score: int
    wave: int
    kills: int
    survived: int
    damage_dealt: int
    result: str
    coins_earned: int
    xp_earned: int
    created_at: datetime


class MatchSubmitResponse(BaseModel):
    match: MatchResponse
    rewards: dict[str, int]
    stats: PlayerStatsResponse


class PlayerResponse(BaseModel):
    id: int
    username: str
    stats: PlayerStatsResponse | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    player: PlayerResponse