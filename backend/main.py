from __future__ import annotations

import argparse
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from app.database import Database
from app.routes import create_router
from app.tts_service import NativeTtsService


def create_app(db_path: Path | str | None = None) -> FastAPI:
    app = FastAPI(
        title="NeuroPulse Focus Backend",
        version="1.1.2",
        docs_url="/docs",
        redoc_url=None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    db = Database(db_path=db_path)
    tts = NativeTtsService()
    app.include_router(create_router(db, tts))
    return app


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="NeuroPulse local Python backend")
    parser.add_argument("--host", default="127.0.0.1", help="Bind host")
    parser.add_argument("--port", type=int, default=18765, help="Bind port")
    parser.add_argument("--db-path", default=None, help="Path to SQLite database file")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    app = create_app(db_path=args.db_path)
    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
