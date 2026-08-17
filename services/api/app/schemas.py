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


class PlayerResponse(BaseModel):
    id: int
    username: str
    stats: PlayerStatsResponse | None = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    player: PlayerResponse