from __future__ import annotations

import random
import uuid

from .schemas import CueEvent, Scene1PlanRequest, Scene1PlanResponse


def generate_scene1_plan(req: Scene1PlanRequest) -> Scene1PlanResponse:
    """
    Build a balanced yet unpredictable randomized voice-cue timeline for Scene 1.

    Timeline coordinates (`at_ms`) represent active training elapsed time
    (excluding the 5-second hand-swap preparation pauses). When the player reaches
    a `hand_swap` event, active time pauses while "请换手" + 5..1 countdown plays,
    ensuring the user completes the full configured training duration.
    """
    total_ms = req.duration_sec * 1000
    rng = random.SystemRandom()

    # Clamp swaps so there is meaningful training time between swaps.
    max_sane_swaps = max(0, (req.duration_sec - 12) // 18)
    effective_swaps = min(req.swap_count, max_sane_swaps)

    swap_triggers_ms: list[int] = []
    if effective_swaps > 0:
        # Place swaps across [18% .. 82%] of total session duration with natural jitter.
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
    cursor_ms = 900  # Brief settle beat right after "开始训练"
    next_swap_idx = 0

    count_a = 0
    count_b = 0
    last_kind: str | None = None
    streak = 0

    while cursor_ms <= total_ms - 600:
        # Insert hand-swap event when cursor crosses the planned trigger
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
            # Reset streak after swap and give 1.1s rhythm breathing room after "继续"
            cursor_ms = swap_triggers_ms[next_swap_idx] + 1100
            last_kind = None
            streak = 0
            next_swap_idx += 1
            continue

        # Anti-streak fair random choice (cap consecutive identical cues at 3)
        if streak >= 3 and last_kind in ("item_a", "item_b"):
            chosen = "item_b" if last_kind == "item_a" else "item_a"
        else:
            # Gentle statistical balance pull when counts diverge noticeably
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

        # Next random interval
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
