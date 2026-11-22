from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field, model_validator


class HealthResponse(BaseModel):
    status: str = "ok"
    version: str = "1.1.0"
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


# --- Scene 2: Stroop Color-Word Interference ---
ColorKey = Literal["red", "blue", "green", "yellow"]


class Scene2PlanRequest(BaseModel):
    duration_sec: int = Field(default=60, ge=15, le=600)
    mode: Literal["ink", "mixed"] = "ink"
    conflict_ratio: float = Field(default=0.8, ge=0.0, le=1.0)
    trial_count: int = Field(default=120, ge=20, le=300)


class StroopTrial(BaseModel):
    seq: int
    word_key: ColorKey
    word_text: str
    ink_key: ColorKey
    rule: Literal["ink", "word"]
    answer_key: ColorKey
    is_conflict: bool
    distractor_speak: str


class Scene2PlanResponse(BaseModel):
    plan_id: str
    mode: Literal["ink", "mixed"]
    duration_sec: int
    trials: list[StroopTrial]


# --- Scene 4: Auditory Go / No-Go Stop-Signal ---
class Scene4PlanRequest(BaseModel):
    go_words: list[str] = Field(default_factory=lambda: ["拍手", "出拳"], min_length=1, max_length=6)
    nogo_words: list[str] = Field(default_factory=lambda: ["停", "别动"], min_length=1, max_length=6)
    duration_sec: int = Field(default=60, ge=15, le=600)
    min_interval_ms: int = Field(default=1300, ge=650, le=5000)
    max_interval_ms: int = Field(default=2200, ge=850, le=7000)
    nogo_ratio: float = Field(default=0.3, ge=0.1, le=0.55)
    response_window_ms: int = Field(default=1200, ge=500, le=2500)

    @model_validator(mode="after")
    def validate_words(self) -> "Scene4PlanRequest":
        self.go_words = [w.strip() for w in self.go_words if w.strip()]
        self.nogo_words = [w.strip() for w in self.nogo_words if w.strip()]
        if not self.go_words or not self.nogo_words:
            raise ValueError("行动词与禁动词均不能为空")
        if self.min_interval_ms > self.max_interval_ms:
            self.max_interval_ms = self.min_interval_ms + 200
        return self


class GoNoGoEvent(BaseModel):
    seq: int
    at_ms: int
    kind: Literal["go", "nogo"]
    word: str
    response_window_ms: int


class Scene4PlanResponse(BaseModel):
    plan_id: str
    duration_sec: int
    response_window_ms: int
    go_count: int
    nogo_count: int
    events: list[GoNoGoEvent]


class SessionCreate(BaseModel):
    scene_id: str = Field(default="scene_1_dual_object", max_length=64)
    item_a: str = Field(..., min_length=1, max_length=32)
    item_b: str = Field(..., min_length=1, max_length=32)
    configured_duration_sec: int = Field(..., ge=1, le=3600)
    actual_duration_sec: int = Field(..., ge=0, le=3600)
    total_cues: int = Field(..., ge=0)
    item_a_count: int = Field(..., ge=0)
    item_b_count: int = Field(..., ge=0)
    swap_count_completed: int = Field(..., ge=0)
    swap_countdown_sec: int = Field(default=5, ge=0, le=30)
    min_interval_ms: int = Field(default=1000, ge=0)
    max_interval_ms: int = Field(default=2000, ge=0)
    blind_mode: bool = False
    completed: bool = True
    focus_score_override: int | None = Field(default=None, ge=0, le=100)
    extra_metrics: dict[str, Any] = Field(default_factory=dict)
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
    texts: list[str] = Field(..., min_length=1, max_length=30)
    rate: float = Field(default=1.0, ge=0.6, le=1.8)
