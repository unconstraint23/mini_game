from __future__ import annotations

import json
import platform
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Response

from .database import Database
from .scheduler import generate_scene1_plan, generate_scene2_plan, generate_scene4_plan
from .schemas import (
    DailyActivity,
    HealthResponse,
    PresetCreate,
    PresetOut,
    Scene1PlanRequest,
    Scene1PlanResponse,
    Scene2PlanRequest,
    Scene2PlanResponse,
    Scene4PlanRequest,
    Scene4PlanResponse,
    SessionCreate,
    SessionOut,
    StatsOverview,
    TtsPrewarmRequest,
    TtsSynthesizeRequest,
    UserSettings,
)
from .tts_service import NativeTtsService


def create_router(db: Database, tts: NativeTtsService) -> APIRouter:
    router = APIRouter()

    @router.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse(
            status="ok",
            version="1.2.0",
            platform=platform.system().lower(),
            native_tts_available=tts.is_available,
            db_path=str(db.db_path),
        )

    @router.get("/api/settings", response_model=UserSettings)
    def get_settings() -> UserSettings:
        with db.connect() as conn:
            row = conn.execute("SELECT * FROM user_settings WHERE id = 1").fetchone()
        if row is None:
            return UserSettings()
        return UserSettings(
            item_a=row["item_a"],
            item_b=row["item_b"],
            duration_sec=row["duration_sec"],
            min_interval_ms=row["min_interval_ms"],
            max_interval_ms=row["max_interval_ms"],
            swap_count=row["swap_count"],
            swap_countdown_sec=row["swap_countdown_sec"],
            speech_rate=row["speech_rate"],
            speech_volume=row["speech_volume"],
            tts_engine=row["tts_engine"],
            voice_name=row["voice_name"],
            sound_fx_enabled=bool(row["sound_fx_enabled"]),
            blind_mode=bool(row["blind_mode"]),
            enable_3d=bool(row["enable_3d"]),
        )

    @router.put("/api/settings", response_model=UserSettings)
    def update_settings(payload: UserSettings) -> UserSettings:
        now = datetime.now(timezone.utc).isoformat()
        with db.connect() as conn:
            conn.execute(
                """
                UPDATE user_settings
                SET item_a = ?,
                    item_b = ?,
                    duration_sec = ?,
                    min_interval_ms = ?,
                    max_interval_ms = ?,
                    swap_count = ?,
                    swap_countdown_sec = ?,
                    speech_rate = ?,
                    speech_volume = ?,
                    tts_engine = ?,
                    voice_name = ?,
                    sound_fx_enabled = ?,
                    blind_mode = ?,
                    enable_3d = ?,
                    updated_at = ?
                WHERE id = 1
                """,
                (
                    payload.item_a,
                    payload.item_b,
                    payload.duration_sec,
                    payload.min_interval_ms,
                    payload.max_interval_ms,
                    payload.swap_count,
                    payload.swap_countdown_sec,
                    payload.speech_rate,
                    payload.speech_volume,
                    payload.tts_engine,
                    payload.voice_name,
                    int(payload.sound_fx_enabled),
                    int(payload.blind_mode),
                    int(payload.enable_3d),
                    now,
                ),
            )
        return payload

    @router.get("/api/presets", response_model=list[PresetOut])
    def list_presets() -> list[PresetOut]:
        with db.connect() as conn:
            rows = conn.execute(
                """
                SELECT * FROM item_presets
                ORDER BY is_default ASC, use_count DESC, id DESC
                """
            ).fetchall()
        return [
            PresetOut(
                id=r["id"],
                name=r["name"],
                item_a=r["item_a"],
                item_b=r["item_b"],
                is_default=bool(r["is_default"]),
                use_count=r["use_count"],
                created_at=r["created_at"],
            )
            for r in rows
        ]

    @router.post("/api/presets", response_model=PresetOut, status_code=201)
    def create_preset(payload: PresetCreate) -> PresetOut:
        now = datetime.now(timezone.utc).isoformat()
        with db.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO item_presets (name, item_a, item_b, is_default, use_count, created_at)
                VALUES (?, ?, ?, 0, 1, ?)
                """,
                (payload.name, payload.item_a, payload.item_b, now),
            )
            preset_id = cur.lastrowid
            row = conn.execute(
                "SELECT * FROM item_presets WHERE id = ?", (preset_id,)
            ).fetchone()
        return PresetOut(
            id=row["id"],
            name=row["name"],
            item_a=row["item_a"],
            item_b=row["item_b"],
            is_default=bool(row["is_default"]),
            use_count=row["use_count"],
            created_at=row["created_at"],
        )

    @router.post("/api/presets/{preset_id}/use", response_model=PresetOut)
    def mark_preset_used(preset_id: int) -> PresetOut:
        with db.connect() as conn:
            conn.execute(
                "UPDATE item_presets SET use_count = use_count + 1 WHERE id = ?",
                (preset_id,),
            )
            row = conn.execute(
                "SELECT * FROM item_presets WHERE id = ?", (preset_id,)
            ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="预设不存在")
        return PresetOut(
            id=row["id"],
            name=row["name"],
            item_a=row["item_a"],
            item_b=row["item_b"],
            is_default=bool(row["is_default"]),
            use_count=row["use_count"],
            created_at=row["created_at"],
        )

    @router.delete("/api/presets/{preset_id}")
    def delete_preset(preset_id: int) -> dict[str, bool]:
        with db.connect() as conn:
            cur = conn.execute("DELETE FROM item_presets WHERE id = ?", (preset_id,))
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="预设不存在")
        return {"deleted": True}

    @router.post("/api/scene1/plan", response_model=Scene1PlanResponse)
    def create_scene1_plan(payload: Scene1PlanRequest) -> Scene1PlanResponse:
        return generate_scene1_plan(payload)

    @router.post("/api/scene2/plan", response_model=Scene2PlanResponse)
    def create_scene2_plan(payload: Scene2PlanRequest) -> Scene2PlanResponse:
        return generate_scene2_plan(payload)

    @router.post("/api/scene4/plan", response_model=Scene4PlanResponse)
    def create_scene4_plan(payload: Scene4PlanRequest) -> Scene4PlanResponse:
        return generate_scene4_plan(payload)

    @router.post("/api/sessions", response_model=SessionOut, status_code=201)
    def save_session(payload: SessionCreate) -> SessionOut:
        if payload.focus_score_override is not None:
            focus_score = min(100, max(0, int(payload.focus_score_override)))
        else:
            completion_ratio = min(
                1.0, payload.actual_duration_sec / max(1, payload.configured_duration_sec)
            )
            base_score = int(round(completion_ratio * 85))
            bonus = 10 if payload.completed else 0
            blind_bonus = 5 if payload.blind_mode and payload.completed else 0
            focus_score = min(100, max(10, base_score + bonus + blind_bonus))

        metrics_json = json.dumps(payload.extra_metrics or {}, ensure_ascii=False)

        with db.connect() as conn:
            cur = conn.execute(
                """
                INSERT INTO training_sessions (
                    scene_id, item_a, item_b,
                    configured_duration_sec, actual_duration_sec,
                    total_cues, item_a_count, item_b_count,
                    swap_count_completed, swap_countdown_sec,
                    min_interval_ms, max_interval_ms,
                    blind_mode, completed, focus_score,
                    extra_metrics, started_at, ended_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    payload.scene_id,
                    payload.item_a,
                    payload.item_b,
                    payload.configured_duration_sec,
                    payload.actual_duration_sec,
                    payload.total_cues,
                    payload.item_a_count,
                    payload.item_b_count,
                    payload.swap_count_completed,
                    payload.swap_countdown_sec,
                    payload.min_interval_ms,
                    payload.max_interval_ms,
                    int(payload.blind_mode),
                    int(payload.completed),
                    focus_score,
                    metrics_json,
                    payload.started_at,
                    payload.ended_at,
                ),
            )
            session_id = cur.lastrowid

        return SessionOut(
            id=session_id,
            focus_score=focus_score,
            **payload.model_dump(),
        )

    @router.get("/api/sessions", response_model=list[SessionOut])
    def list_sessions(limit: int = 50, scene_id: str | None = None) -> list[SessionOut]:
        safe_limit = max(1, min(200, limit))
        with db.connect() as conn:
            if scene_id:
                rows = conn.execute(
                    """
                    SELECT * FROM training_sessions
                    WHERE scene_id = ?
                    ORDER BY ended_at DESC, id DESC
                    LIMIT ?
                    """,
                    (scene_id, safe_limit),
                ).fetchall()
            else:
                rows = conn.execute(
                    """
                    SELECT * FROM training_sessions
                    ORDER BY ended_at DESC, id DESC
                    LIMIT ?
                    """,
                    (safe_limit,),
                ).fetchall()

        results: list[SessionOut] = []
        for r in rows:
            try:
                extra = json.loads(r["extra_metrics"] or "{}")
                if not isinstance(extra, dict):
                    extra = {}
            except Exception:
                extra = {}
            results.append(
                SessionOut(
                    id=r["id"],
                    scene_id=r["scene_id"],
                    item_a=r["item_a"],
                    item_b=r["item_b"],
                    configured_duration_sec=r["configured_duration_sec"],
                    actual_duration_sec=r["actual_duration_sec"],
                    total_cues=r["total_cues"],
                    item_a_count=r["item_a_count"],
                    item_b_count=r["item_b_count"],
                    swap_count_completed=r["swap_count_completed"],
                    swap_countdown_sec=r["swap_countdown_sec"],
                    min_interval_ms=r["min_interval_ms"],
                    max_interval_ms=r["max_interval_ms"],
                    blind_mode=bool(r["blind_mode"]),
                    completed=bool(r["completed"]),
                    focus_score=r["focus_score"],
                    extra_metrics=extra,
                    started_at=r["started_at"],
                    ended_at=r["ended_at"],
                )
            )
        return results

    @router.delete("/api/sessions/{session_id}")
    def delete_session(session_id: int) -> dict[str, bool]:
        with db.connect() as conn:
            cur = conn.execute(
                "DELETE FROM training_sessions WHERE id = ?", (session_id,)
            )
            if cur.rowcount == 0:
                raise HTTPException(status_code=404, detail="训练记录不存在")
        return {"deleted": True}

    @router.get("/api/stats", response_model=StatsOverview)
    def get_stats() -> StatsOverview:
        with db.connect() as conn:
            rows = conn.execute(
                """
                SELECT actual_duration_sec, total_cues, swap_count_completed, completed, ended_at
                FROM training_sessions
                ORDER BY ended_at DESC
                """
            ).fetchall()

        total_sessions = len(rows)
        completed_sessions = sum(1 for r in rows if r["completed"])
        total_focus_sec = sum(r["actual_duration_sec"] for r in rows)
        total_cues = sum(r["total_cues"] for r in rows)
        total_swaps = sum(r["swap_count_completed"] for r in rows)

        today = date.today()
        daily_map: dict[str, dict[str, int]] = {}
        active_dates: set[date] = set()

        for r in rows:
            try:
                dt = datetime.fromisoformat(r["ended_at"].replace("Z", "+00:00"))
                local_day = dt.astimezone().date()
            except Exception:
                local_day = today
            day_str = local_day.isoformat()
            active_dates.add(local_day)
            entry = daily_map.setdefault(
                day_str, {"sessions": 0, "duration_sec": 0, "cues": 0}
            )
            entry["sessions"] += 1
            entry["duration_sec"] += int(r["actual_duration_sec"])
            entry["cues"] += int(r["total_cues"])

        streak = 0
        cursor = today if today in active_dates else today - timedelta(days=1)
        while cursor in active_dates:
            streak += 1
            cursor -= timedelta(days=1)

        recent_7: list[DailyActivity] = []
        for offset in range(6, -1, -1):
            d = today - timedelta(days=offset)
            key = d.isoformat()
            info = daily_map.get(key, {"sessions": 0, "duration_sec": 0, "cues": 0})
            recent_7.append(
                DailyActivity(
                    date=key,
                    sessions=info["sessions"],
                    duration_sec=info["duration_sec"],
                    cues=info["cues"],
                )
            )

        today_info = daily_map.get(
            today.isoformat(), {"sessions": 0, "duration_sec": 0, "cues": 0}
        )

        return StatsOverview(
            total_sessions=total_sessions,
            completed_sessions=completed_sessions,
            total_focus_sec=total_focus_sec,
            total_cues=total_cues,
            total_swaps=total_swaps,
            streak_days=streak,
            today_sessions=today_info["sessions"],
            today_focus_sec=today_info["duration_sec"],
            recent_7_days=recent_7,
        )

    @router.post("/api/tts/synthesize")
    async def synthesize_tts(payload: TtsSynthesizeRequest) -> Response:
        if not tts.is_available:
            raise HTTPException(
                status_code=503, detail="当前系统不支持原生离线语音合成"
            )
        try:
            wav_bytes = await tts.synthesize(payload.text, payload.rate)
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"语音合成失败: {exc}") from exc
        return Response(content=wav_bytes, media_type="audio/wav")

    @router.post("/api/tts/prewarm")
    async def prewarm_tts(payload: TtsPrewarmRequest) -> dict[str, int | bool]:
        count = await tts.prewarm(payload.texts, payload.rate)
        return {"available": tts.is_available, "warmed": count}

    return router
