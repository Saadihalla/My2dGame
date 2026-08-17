from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings


class Base(DeclarativeBase):
    pass


# asyncpg wants a postgresql+asyncpg:// URL; convert plain postgresql://
def _async_url(url: str) -> str:
    if url.startswith("postgresql://") and "+asyncpg" not in url:
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


engine = create_async_engine(_async_url(settings.database_url), pool_pre_ping=True)

SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session():
    async with SessionLocal() as session:
        yield session