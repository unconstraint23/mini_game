from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterator

DEFAULT_PRESETS = [
    ("经典反应双球", "红球", "蓝球"),
    ("桌面随手拿", "水杯", "手机"),
    ("办公专注组", "钢笔", "钥匙"),
    ("徒手零道具", "左手", "右手"),
    ("果香辨识组", "苹果", "橙子"),
]


def resolve_default_db_path() -> Path:
    env_path = os.environ.get("NEUROPULSE_DB_PATH")
    if env_path:
        return Path(env_path).expanduser().resolve()
    base_dir = Path.home() / ".neuropulse"
    base_dir.mkdir(parents=True, exist_ok=True)
    return base_dir / "neuropulse.db"


class Database:
    def __init__(self, db_path: Path | str | None = None) -> None:
        self.db_path = Path(db_path) if db_path else resolve_default_db_path()
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_schema()

    @contextmanager
    def connect(self) -> Iterator[sqlite3.Connection]:
        conn = sqlite3.connect(str(self.db_path), timeout=15.0, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()

    def _init_schema(self) -> None:
        now = datetime.now(timezone.utc).isoformat()
        with self.connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS item_presets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    item_a TEXT NOT NULL,
                    item_b TEXT NOT NULL,
                    is_default INTEGER NOT NULL DEFAULT 0,
                    use_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS user_settings (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    item_a TEXT NOT NULL DEFAULT '红球',
                    item_b TEXT NOT NULL DEFAULT '蓝球',
                    duration_sec INTEGER NOT NULL DEFAULT 120,
                    min_interval_ms INTEGER NOT NULL DEFAULT 1400,
                    max_interval_ms INTEGER NOT NULL DEFAULT 2600,
                    swap_count INTEGER NOT NULL DEFAULT 2,
                    swap_countdown_sec INTEGER NOT NULL DEFAULT 5,
                    speech_rate REAL NOT NULL DEFAULT 1.05,
                    speech_volume REAL NOT NULL DEFAULT 1.0,
                    tts_engine TEXT NOT NULL DEFAULT 'auto',
                    voice_name TEXT NOT NULL DEFAULT '',
                    sound_fx_enabled INTEGER NOT NULL DEFAULT 1,
                    blind_mode INTEGER NOT NULL DEFAULT 0,
                    enable_3d INTEGER NOT NULL DEFAULT 1,
                    updated_at TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS training_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    scene_id TEXT NOT NULL DEFAULT 'scene_1_dual_object',
                    item_a TEXT NOT NULL,
                    item_b TEXT NOT NULL,
                    configured_duration_sec INTEGER NOT NULL,
                    actual_duration_sec INTEGER NOT NULL,
                    total_cues INTEGER NOT NULL,
                    item_a_count INTEGER NOT NULL,
                    item_b_count INTEGER NOT NULL,
                    swap_count_completed INTEGER NOT NULL,
                    swap_countdown_sec INTEGER NOT NULL DEFAULT 5,
                    min_interval_ms INTEGER NOT NULL,
                    max_interval_ms INTEGER NOT NULL,
                    blind_mode INTEGER NOT NULL DEFAULT 0,
                    completed INTEGER NOT NULL DEFAULT 1,
                    focus_score INTEGER NOT NULL DEFAULT 100,
                    started_at TEXT NOT NULL,
                    ended_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_sessions_ended_at
                ON training_sessions (ended_at DESC);
                """
            )

            settings_row = conn.execute(
                "SELECT id FROM user_settings WHERE id = 1"
            ).fetchone()
            if settings_row is None:
                conn.execute(
                    """
                    INSERT INTO user_settings (id, updated_at)
                    VALUES (1, ?)
                    """,
                    (now,),
                )

            preset_count = conn.execute(
                "SELECT COUNT(*) AS cnt FROM item_presets"
            ).fetchone()["cnt"]
            if preset_count == 0:
                conn.executemany(
                    """
                    INSERT INTO item_presets (name, item_a, item_b, is_default, use_count, created_at)
                    VALUES (?, ?, ?, 1, 0, ?)
                    """,
                    [(name, a, b, now) for (name, a, b) in DEFAULT_PRESETS],
                )
