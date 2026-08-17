from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://user:pass@localhost/darkfantasy"
    jwt_secret: str = "dev-secret-change-me"
    access_token_minutes: int = 15
    refresh_token_days: int = 30
    cors_origins: str = "*"

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins == "*":
            return ["*"]
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()