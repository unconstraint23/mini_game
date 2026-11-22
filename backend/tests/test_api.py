from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
import platform

from fastapi.testclient import TestClient

from main import create_app


def make_client(tmp_path: Path) -> TestClient:
    app = create_app(db_path=tmp_path / "test.db")
    return TestClient(app)


def test_health_and_default_seed(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"

    presets = client.get("/api/presets").json()
    assert len(presets) >= 5
    assert any(p["item_a"] == "红球" and p["item_b"] == "蓝球" for p in presets)

    settings = client.get("/api/settings").json()
    assert settings["duration_sec"] == 120
    assert settings["swap_countdown_sec"] == 5


def test_settings_and_presets_crud(tmp_path: Path) -> None:
    client = make_client(tmp_path)

    updated = client.put(
        "/api/settings",
        json={
            "item_a": "可乐",
            "item_b": "雪碧",
            "duration_sec": 180,
            "min_interval_ms": 1000,
            "max_interval_ms": 2000,
            "swap_count": 3,
            "swap_countdown_sec": 5,
            "speech_rate": 1.2,
            "speech_volume": 0.9,
            "tts_engine": "auto",
            "voice_name": "",
            "sound_fx_enabled": True,
            "blind_mode": True,
            "enable_3d": True,
        },
    )
    assert updated.status_code == 200
    assert client.get("/api/settings").json()["item_a"] == "可乐"

    created = client.post(
        "/api/presets",
        json={"name": "饮料测试", "item_a": "可乐", "item_b": "雪碧"},
    )
    assert created.status_code == 201
    pid = created.json()["id"]

    used = client.post(f"/api/presets/{pid}/use")
    assert used.status_code == 200
    assert used.json()["use_count"] == 2

    deleted = client.delete(f"/api/presets/{pid}")
    assert deleted.status_code == 200


def test_scene1_plan_generation_and_swap_rules(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    res = client.post(
        "/api/scene1/plan",
        json={
            "item_a": "红球",
            "item_b": "蓝球",
            "duration_sec": 120,
            "min_interval_ms": 1400,
            "max_interval_ms": 2400,
            "swap_count": 2,
            "swap_countdown_sec": 5,
        },
    )
    assert res.status_code == 200
    plan = res.json()
    assert plan["planned_swaps"] == 2
    assert plan["expected_cues"] > 20

    swaps = [e for e in plan["events"] if e["kind"] == "hand_swap"]
    assert len(swaps) == 2
    assert all(s["countdown_sec"] == 5 and s["speak_text"] == "请换手" for s in swaps)

    # Check anti-streak cap (max 3 consecutive identical item cues)
    streak = 0
    last = None
    for e in plan["events"]:
        if e["kind"] == "hand_swap":
            streak = 0
            last = None
            continue
        if e["kind"] == last:
            streak += 1
        else:
            last = e["kind"]
            streak = 1
        assert streak <= 3


def test_session_history_and_stats(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    now = datetime.now(timezone.utc).isoformat()
    res = client.post(
        "/api/sessions",
        json={
            "scene_id": "scene_1_dual_object",
            "item_a": "红球",
            "item_b": "蓝球",
            "configured_duration_sec": 120,
            "actual_duration_sec": 120,
            "total_cues": 58,
            "item_a_count": 30,
            "item_b_count": 28,
            "swap_count_completed": 2,
            "swap_countdown_sec": 5,
            "min_interval_ms": 1400,
            "max_interval_ms": 2400,
            "blind_mode": False,
            "completed": True,
            "started_at": now,
            "ended_at": now,
        },
    )
    assert res.status_code == 201
    saved = res.json()
    assert saved["focus_score"] >= 90

    sessions = client.get("/api/sessions").json()
    assert len(sessions) == 1

    stats = client.get("/api/stats").json()
    assert stats["total_sessions"] == 1
    assert stats["total_focus_sec"] == 120
    assert stats["streak_days"] >= 1
    assert len(stats["recent_7_days"]) == 7


def test_native_tts_endpoint(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    if platform.system().lower() == "darwin":
        res = client.post("/api/tts/synthesize", json={"text": "请换手", "rate": 1.0})
        assert res.status_code == 200
        assert res.headers["content-type"].startswith("audio/wav")
        assert res.content[:4] == b"RIFF"


def test_scene2_stroop_plan_and_session(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    res = client.post(
        "/api/scene2/plan",
        json={"duration_sec": 60, "mode": "mixed", "conflict_ratio": 0.85, "trial_count": 40},
    )
    assert res.status_code == 200
    plan = res.json()
    assert len(plan["trials"]) == 40
    for t in plan["trials"]:
        expected = t["ink_key"] if t["rule"] == "ink" else t["word_key"]
        assert t["answer_key"] == expected

    now = datetime.now(timezone.utc).isoformat()
    save_res = client.post(
        "/api/sessions",
        json={
            "scene_id": "scene_2_stroop",
            "item_a": "色词抗干扰",
            "item_b": "混合规则",
            "configured_duration_sec": 60,
            "actual_duration_sec": 60,
            "total_cues": 38,
            "item_a_count": 35,
            "item_b_count": 3,
            "swap_count_completed": 0,
            "focus_score_override": 92,
            "extra_metrics": {"accuracy_pct": 92, "avg_reaction_ms": 512, "max_combo": 14},
            "started_at": now,
            "ended_at": now,
        },
    )
    assert save_res.status_code == 201
    assert save_res.json()["focus_score"] == 92
    filtered = client.get("/api/sessions?scene_id=scene_2_stroop").json()
    assert len(filtered) == 1
    assert filtered[0]["extra_metrics"]["avg_reaction_ms"] == 512


def test_scene4_gonogo_plan_rules(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    res = client.post(
        "/api/scene4/plan",
        json={
            "go_words": ["拍手", "出拳"],
            "nogo_words": ["停", "别动"],
            "duration_sec": 60,
            "min_interval_ms": 1300,
            "max_interval_ms": 2000,
            "nogo_ratio": 0.3,
            "response_window_ms": 1100,
        },
    )
    assert res.status_code == 200
    plan = res.json()
    assert plan["go_count"] >= 2
    assert plan["nogo_count"] >= 1
    assert plan["events"][0]["kind"] == "go"
    assert plan["events"][1]["kind"] == "go"

    nogo_streak = 0
    for ev in plan["events"]:
        if ev["kind"] == "nogo":
            nogo_streak += 1
        else:
            nogo_streak = 0
        assert nogo_streak <= 2

