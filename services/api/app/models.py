from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Player(Base):
    __tablename__ = "players"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlayerStats(Base):
    __tablename__ = "player_stats"

    player_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("players.id", ondelete="CASCADE"), primary_key=True
    )
    level: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    xp: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    coins: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    high_score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("players.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MatchHistory(Base):
    __tablename__ = "match_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    player_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("players.id", ondelete="CASCADE"), index=True)
    mode: Mapped[str] = mapped_column(String(20), default="solo", server_default="solo")
    score: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    wave: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    kills: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    survived: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    damage_dealt: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    result: Mapped[str] = mapped_column(String(10), default="victory", server_default="victory")
    coins_earned: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    xp_earned: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())