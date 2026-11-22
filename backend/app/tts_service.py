from __future__ import annotations

import asyncio
import hashlib
import platform
import shutil
import subprocess
import tempfile
from collections import OrderedDict
from pathlib import Path


class NativeTtsService:
    """
    Zero-dependency offline OS-native TTS fallback returning standard PCM WAV bytes.
    - macOS: uses `/usr/bin/say` + `/usr/bin/afconvert` (built into macOS)
    - Windows 11: uses PowerShell `System.Speech.Synthesis.SpeechSynthesizer` (built into Win11)
    Audio bytes are cached in-memory (LRU) so repeated game words play instantaneously.
    """

    def __init__(self, max_cache_items: int = 128) -> None:
        self.system = platform.system().lower()
        self.max_cache_items = max_cache_items
        self._cache: OrderedDict[str, bytes] = OrderedDict()
        self._mac_voice: str | None = self._detect_mac_voice() if self.system == "darwin" else None

    @property
    def is_available(self) -> bool:
        if self.system == "darwin":
            return bool(shutil.which("say") and shutil.which("afconvert"))
        if self.system == "windows":
            return bool(shutil.which("powershell") or shutil.which("pwsh"))
        return False

    def _detect_mac_voice(self) -> str | None:
        if not shutil.which("say"):
            return None
        try:
            proc = subprocess.run(
                ["say", "-v", "?"],
                capture_output=True,
                text=True,
                timeout=3,
                check=False,
            )
            voices = proc.stdout.splitlines()
            preferred = ("Tingting", "Ting-Ting", "Sinji", "Meijia")
            for name in preferred:
                for line in voices:
                    if line.startswith(name + " "):
                        return name
            for line in voices:
                if "zh_CN" in line or "zh-CN" in line:
                    return line.split()[0]
        except Exception:
            pass
        return None

    def _cache_key(self, text: str, rate: float) -> str:
        rate_bucket = round(rate, 2)
        raw = f"{text}|{rate_bucket}|{self._mac_voice or ''}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:24]

    def _put_cache(self, key: str, data: bytes) -> None:
        self._cache[key] = data
        self._cache.move_to_end(key)
        while len(self._cache) > self.max_cache_items:
            self._cache.popitem(last=False)

    def synthesize_sync(self, text: str, rate: float = 1.0) -> bytes:
        clean_text = text.strip()
        if not clean_text:
            raise ValueError("Empty TTS text")

        key = self._cache_key(clean_text, rate)
        cached = self._cache.get(key)
        if cached is not None:
            self._cache.move_to_end(key)
            return cached

        if self.system == "darwin":
            audio = self._synthesize_macos(clean_text, rate)
        elif self.system == "windows":
            audio = self._synthesize_windows(clean_text, rate)
        else:
            raise RuntimeError(f"Native offline TTS is not supported on {self.system}")

        self._put_cache(key, audio)
        return audio

    async def synthesize(self, text: str, rate: float = 1.0) -> bytes:
        return await asyncio.to_thread(self.synthesize_sync, text, rate)

    async def prewarm(self, texts: list[str], rate: float = 1.0) -> int:
        if not self.is_available:
            return 0
        unique_texts = list(dict.fromkeys(t.strip() for t in texts if t.strip()))
        tasks = [self.synthesize(t, rate) for t in unique_texts]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        return sum(1 for r in results if isinstance(r, bytes))

    def _synthesize_macos(self, text: str, rate: float) -> bytes:
        # macOS `say` default rate is ~185 wpm; scale safely between 130 and 310
        wpm = int(max(130, min(310, round(185 * rate))))
        with tempfile.TemporaryDirectory(prefix="np_tts_") as tmpdir:
            aiff_path = Path(tmpdir) / "speech.aiff"
            wav_path = Path(tmpdir) / "speech.wav"
            cmd = ["say", "-r", str(wpm), "-o", str(aiff_path)]
            if self._mac_voice:
                cmd.extend(["-v", self._mac_voice])
            cmd.append(text)
            res = subprocess.run(cmd, capture_output=True, timeout=8, check=False)
            if res.returncode != 0 or not aiff_path.exists():
                raise RuntimeError(f"macOS say failed: {res.stderr.decode(errors='ignore')}")

            conv = subprocess.run(
                [
                    "afconvert",
                    "-f",
                    "WAVE",
                    "-d",
                    "LEI16@22050",
                    "-c",
                    "1",
                    str(aiff_path),
                    str(wav_path),
                ],
                capture_output=True,
                timeout=8,
                check=False,
            )
            if conv.returncode != 0 or not wav_path.exists():
                raise RuntimeError(f"afconvert failed: {conv.stderr.decode(errors='ignore')}")
            return wav_path.read_bytes()

    def _synthesize_windows(self, text: str, rate: float) -> bytes:
        # SAPI rate is integer -10..10 (0 = 1.0x)
        sapi_rate = int(max(-5, min(6, round((rate - 1.0) * 6))))
        escaped_text = text.replace("'", "''")
        with tempfile.TemporaryDirectory(prefix="np_tts_") as tmpdir:
            wav_path = Path(tmpdir) / "speech.wav"
            escaped_path = str(wav_path).replace("'", "''")
            ps_script = (
                "Add-Type -AssemblyName System.Speech; "
                "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer; "
                f"$s.Rate = {sapi_rate}; "
                "$zh = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Culture.Name -like 'zh*' } | Select-Object -First 1; "
                "if ($zh) { $s.SelectVoice($zh.VoiceInfo.Name) }; "
                f"$s.SetOutputToWaveFile('{escaped_path}'); "
                f"$s.Speak('{escaped_text}'); "
                "$s.Dispose();"
            )
            shell = shutil.which("powershell") or shutil.which("pwsh") or "powershell"
            creationflags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
            res = subprocess.run(
                [shell, "-NoProfile", "-NonInteractive", "-Command", ps_script],
                capture_output=True,
                timeout=10,
                check=False,
                creationflags=creationflags,
            )
            if res.returncode != 0 or not wav_path.exists():
                raise RuntimeError(f"Windows SAPI failed: {res.stderr.decode(errors='ignore')}")
            return wav_path.read_bytes()
