from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.0.0"
    platform: str
    native_tts_available: bool
    db_path: str


class PresetOut(BaseModel):
    id: int
    name: str
    item_a: str
    item_b: str
    is_default: bool
    use_count: int
    created_at: str


class PresetCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=32)
    item_a: str = Field(..., min_length=1, max_length=24)
    item_b: str = Field(..., min_length=1, max_length=24)

    @model_validator(mode="after")
    def validate_distinct_items(self) -> "PresetCreate":
        self.name = self.name.strip()
        self.item_a = self.item_a.strip()
        self.item_b = self.item_b.strip()
        if not self.item_a or not self.item_b:
            raise ValueError("两种物品名称不能为空")
        if self.item_a == self.item_b:
            raise ValueError("两种物品名称不能相同")
        return self


class UserSettings(BaseModel):
    item_a: str = Field(default="红球", min_length=1, max_length=24)
    item_b: str = Field(default="蓝球", min_length=1, max_length=24)
    duration_sec: int = Field(default=120, ge=15, le=1800)
    min_interval_ms: int = Field(default=1400, ge=500, le=8000)
    max_interval_ms: int = Field(default=2600, ge=700, le=10000)
    swap_count: int = Field(default=2, ge=0, le=10)
    swap_countdown_sec: int = Field(default=5, ge=3, le=15)
    speech_rate: float = Field(default=1.05, ge=0.7, le=1.8)
    speech_volume: float = Field(default=1.0, ge=0.1, le=1.0)
    tts_engine: Literal["auto", "webspeech", "native"] = "auto"
    voice_name: str = Field(default="", max_length=120)
    sound_fx_enabled: bool = True
    blind_mode: bool = False
    enable_3d: bool = True

    @model_validator(mode="after")
    def validate_ranges(self) -> "UserSettings":
        self.item_a = self.item_a.strip()
        self.item_b = self.item_b.strip()
        if not self.item_a or not self.item_b:
            raise ValueError("物品名称不能为空")
        if self.min_interval_ms > self.max_interval_ms:
            self.max_interval_ms = self.min_interval_ms + 200
        return self


class Scene1PlanRequest(BaseModel):
    item_a: str = Field(..., min_length=1, max_length=24)
    item_b: str = Field(..., min_length=1, max_length=24)
    duration_sec: int = Field(default=120, ge=15, le=1800)
    min_interval_ms: int = Field(default=1400, ge=500, le=8000)
    max_interval_ms: int = Field(default=2600, ge=700, le=10000)
    swap_count: int = Field(default=2, ge=0, le=10)
    swap_countdown_sec: int = Field(default=5, ge=3, le=15)

    @model_validator(mode="after")
    def validate_plan(self) -> "Scene1PlanRequest":
        self.item_a = self.item_a.strip()
        self.item_b = self.item_b.strip()
        if not self.item_a or not self.item_b:
            raise ValueError("两种物品名称不能为空")
        if self.item_a == self.item_b:
            raise ValueError("两种物品名称不能完全相同")
        if self.min_interval_ms > self.max_interval_ms:
            self.max_interval_ms = self.min_interval_ms + 200
        return self


class CueEvent(BaseModel):
    seq: int
    at_ms: int
    kind: Literal["item_a", "item_b", "hand_swap"]
    label: str
    speak_text: str
    countdown_sec: int = 0


class Scene1PlanResponse(BaseModel):
    plan_id: str
    item_a: str
    item_b: str
    duration_sec: int
    swap_countdown_sec: int
    expected_cues: int
    planned_swaps: int
    events: list[CueEvent]


class SessionCreate(BaseModel):
    scene_id: str = Field(default="scene_1_dual_object", max_length=64)
    item_a: str = Field(..., min_length=1, max_length=24)
    item_b: str = Field(..., min_length=1, max_length=24)
    configured_duration_sec: int = Field(..., ge=1, le=3600)
    actual_duration_sec: int = Field(..., ge=0, le=3600)
    total_cues: int = Field(..., ge=0)
    item_a_count: int = Field(..., ge=0)
    item_b_count: int = Field(..., ge=0)
    swap_count_completed: int = Field(..., ge=0)
    swap_countdown_sec: int = Field(default=5, ge=1, le=30)
    min_interval_ms: int = Field(..., ge=200)
    max_interval_ms: int = Field(..., ge=200)
    blind_mode: bool = False
    completed: bool = True
    started_at: str
    ended_at: str


class SessionOut(SessionCreate):
    id: int
    focus_score: int


class DailyActivity(BaseModel):
    date: str
    sessions: int
    duration_sec: int
    cues: int


class StatsOverview(BaseModel):
    total_sessions: int
    completed_sessions: int
    total_focus_sec: int
    total_cues: int
    total_swaps: int
    streak_days: int
    today_sessions: int
    today_focus_sec: int
    recent_7_days: list[DailyActivity]


class TtsSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=120)
    rate: float = Field(default=1.0, ge=0.6, le=1.8)


class TtsPrewarmRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=20)
    rate: float = Field(default=1.0, ge=0.6, le=1.8)
