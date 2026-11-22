from __future__ import annotations

import random
import uuid

from .schemas import (
    ColorKey,
    CueEvent,
    GoNoGoEvent,
    Scene1PlanRequest,
    Scene1PlanResponse,
    Scene2PlanRequest,
    Scene2PlanResponse,
    Scene4PlanRequest,
    Scene4PlanResponse,
    StroopTrial,
)

STROOP_COLORS: list[tuple[ColorKey, str]] = [
    ("red", "红"),
    ("blue", "蓝"),
    ("green", "绿"),
    ("yellow", "黄"),
]
STROOP_TEXT_MAP: dict[ColorKey, str] = dict(STROOP_COLORS)


def generate_scene1_plan(req: Scene1PlanRequest) -> Scene1PlanResponse:
    """
    Build a balanced yet unpredictable randomized voice-cue timeline for Scene 1.
    """
    total_ms = req.duration_sec * 1000
    rng = random.SystemRandom()

    max_sane_swaps = max(0, (req.duration_sec - 12) // 18)
    effective_swaps = min(req.swap_count, max_sane_swaps)

    swap_triggers_ms: list[int] = []
    if effective_swaps > 0:
        start_window = max(8_000, int(total_ms * 0.18))
        end_window = min(total_ms - 8_000, int(total_ms * 0.82))
        if end_window > start_window:
            span = end_window - start_window
            slot = span / effective_swaps
            for idx in range(effective_swaps):
                center = start_window + slot * (idx + 0.5)
                jitter = min(slot * 0.28, 6_000)
                trigger = int(center + rng.uniform(-jitter, jitter))
                trigger = max(start_window, min(end_window, trigger))
                swap_triggers_ms.append(trigger)
            swap_triggers_ms.sort()

    events: list[CueEvent] = []
    seq = 0
    cursor_ms = 900
    next_swap_idx = 0

    count_a = 0
    count_b = 0
    last_kind: str | None = None
    streak = 0

    while cursor_ms <= total_ms - 600:
        if next_swap_idx < len(swap_triggers_ms) and cursor_ms >= swap_triggers_ms[next_swap_idx]:
            seq += 1
            events.append(
                CueEvent(
                    seq=seq,
                    at_ms=swap_triggers_ms[next_swap_idx],
                    kind="hand_swap",
                    label="换手准备",
                    speak_text="请换手",
                    countdown_sec=req.swap_countdown_sec,
                )
            )
            cursor_ms = swap_triggers_ms[next_swap_idx] + 1100
            last_kind = None
            streak = 0
            next_swap_idx += 1
            continue

        if streak >= 3 and last_kind in ("item_a", "item_b"):
            chosen = "item_b" if last_kind == "item_a" else "item_a"
        else:
            diff = count_a - count_b
            prob_a = max(0.28, min(0.72, 0.5 - diff * 0.05))
            chosen = "item_a" if rng.random() < prob_a else "item_b"

        if chosen == last_kind:
            streak += 1
        else:
            last_kind = chosen
            streak = 1

        if chosen == "item_a":
            count_a += 1
            label = req.item_a
        else:
            count_b += 1
            label = req.item_b

        seq += 1
        events.append(
            CueEvent(
                seq=seq,
                at_ms=cursor_ms,
                kind=chosen,
                label=label,
                speak_text=label,
                countdown_sec=0,
            )
        )

        step_ms = rng.randint(req.min_interval_ms, req.max_interval_ms)
        cursor_ms += step_ms

    return Scene1PlanResponse(
        plan_id=uuid.uuid4().hex[:12],
        item_a=req.item_a,
        item_b=req.item_b,
        duration_sec=req.duration_sec,
        swap_countdown_sec=req.swap_countdown_sec,
        expected_cues=count_a + count_b,
        planned_swaps=next_swap_idx,
        events=events,
    )


def generate_scene2_plan(req: Scene2PlanRequest) -> Scene2PlanResponse:
    """
    Generate a Stroop color-word interference trial deck.
    Avoids identical consecutive (word, ink) pairs so every trial requires fresh processing.
    """
    rng = random.SystemRandom()
    color_keys: list[ColorKey] = [k for k, _ in STROOP_COLORS]
    trials: list[StroopTrial] = []
    prev_pair: tuple[ColorKey, ColorKey] | None = None

    for seq in range(1, req.trial_count + 1):
        want_conflict = rng.random() < req.conflict_ratio

        for _ in range(10):
            word_key = rng.choice(color_keys)
            if want_conflict:
                ink_key = rng.choice([k for k in color_keys if k != word_key])
            else:
                ink_key = word_key
            if (word_key, ink_key) != prev_pair:
                break

        prev_pair = (word_key, ink_key)
        rule = "ink" if req.mode == "ink" else ("ink" if rng.random() < 0.5 else "word")
        answer_key = ink_key if rule == "ink" else word_key

        # Distractor voice intentionally speaks a conflicting color name!
        distractor_choices = [k for k in color_keys if k != answer_key]
        distractor_key = rng.choice(distractor_choices)

        trials.append(
            StroopTrial(
                seq=seq,
                word_key=word_key,
                word_text=STROOP_TEXT_MAP[word_key],
                ink_key=ink_key,
                rule=rule,
                answer_key=answer_key,
                is_conflict=word_key != ink_key,
                distractor_speak=STROOP_TEXT_MAP[distractor_key],
            )
        )

    return Scene2PlanResponse(
        plan_id=uuid.uuid4().hex[:12],
        mode=req.mode,
        duration_sec=req.duration_sec,
        trials=trials,
    )


def generate_scene4_plan(req: Scene4PlanRequest) -> Scene4PlanResponse:
    """
    Generate an auditory Go / No-Go impulse-inhibition schedule.
    Ensures the first 2 cues are Go (builds prepotent motor readiness!)
    and caps consecutive No-Go cues at 2.
    """
    rng = random.SystemRandom()
    total_ms = req.duration_sec * 1000
    events: list[GoNoGoEvent] = []

    cursor_ms = 900
    seq = 0
    go_count = 0
    nogo_count = 0
    nogo_streak = 0
    go_streak = 0

    while cursor_ms <= total_ms - 800:
        seq += 1
        if seq <= 2:
            kind = "go"
        elif nogo_streak >= 2:
            kind = "go"
        elif go_streak >= 5:
            kind = "nogo"
        else:
            kind = "nogo" if rng.random() < req.nogo_ratio else "go"

        if kind == "go":
            go_count += 1
            go_streak += 1
            nogo_streak = 0
            word = rng.choice(req.go_words)
        else:
            nogo_count += 1
            nogo_streak += 1
            go_streak = 0
            word = rng.choice(req.nogo_words)

        events.append(
            GoNoGoEvent(
                seq=seq,
                at_ms=cursor_ms,
                kind=kind,
                word=word,
                response_window_ms=req.response_window_ms,
            )
        )

        # Ensure next cue never overlaps the current response window
        effective_min = max(req.min_interval_ms, req.response_window_ms + 180)
        effective_max = max(req.max_interval_ms, effective_min + 250)
        cursor_ms += rng.randint(effective_min, effective_max)

    return Scene4PlanResponse(
        plan_id=uuid.uuid4().hex[:12],
        duration_sec=req.duration_sec,
        response_window_ms=req.response_window_ms,
        go_count=go_count,
        nogo_count=nogo_count,
        events=events,
    )
