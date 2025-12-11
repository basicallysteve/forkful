import urllib.parse
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    APP_ENV: str = "development"
    DB_USER: str
    DB_PASSWORD: str
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_NAME: str

    JWT_SECRET_KEY: str
    JWT_ENCODING_ALGORITHM: str = "HS256"
    JWT_TOKEN_EXPIRE_MINUTES: int = 30

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
    )

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.DB_USER}:"
            f"{urllib.parse.quote_plus(self.DB_PASSWORD)}@"
            f"{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )
    
    def jwt_settings(self):
        return {
            "secret_key": self.JWT_SECRET_KEY,
            "algorithm": self.JWT_ENCODING_ALGORITHM,
            "access_token_expire_minutes": self.JWT_TOKEN_EXPIRE_MINUTES,
        }
settings = Settings()