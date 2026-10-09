import argparse
import asyncio
import json
from pathlib import Path
import subprocess

import edge_tts

ROOT = Path(__file__).resolve().parent
VOICE = "zh-CN-YunxiNeural"


def load_words():
    result = subprocess.run(
        ["node", "-e", "process.stdout.write(JSON.stringify(require('./data.js').words))"],
        cwd=ROOT,
        check=True,
        capture_output=True,
        encoding="utf-8",
    )
    return json.loads(result.stdout)


async def generate(force):
    if not ROOT.is_dir():
        raise RuntimeError("Site directory is missing")
    directory = ROOT / "audio"
    directory.mkdir(exist_ok=True)
    voices = await edge_tts.list_voices()
    if not any(v["ShortName"] == VOICE for v in voices):
        raise RuntimeError(f"Chinese voice unavailable: {VOICE}")
    for word in load_words():
        for variant, rate in [("audio", "+0%"), ("slow", "-22%")]:
            destination = ROOT / word[variant]
            if destination.exists() and destination.stat().st_size > 1000 and not force:
                print(f"Existing: {destination.name}", flush=True)
                continue
            temporary = destination.with_suffix(".partial.mp3")
            for attempt in range(3):
                try:
                    speech = edge_tts.Communicate(word["hanzi"], VOICE, rate=rate)
                    await asyncio.wait_for(speech.save(str(temporary)), timeout=60)
                    if temporary.stat().st_size < 1000:
                        raise RuntimeError("Empty or incomplete audio")
                    temporary.replace(destination)
                    print(f"Generated: {destination.name}", flush=True)
                    break
                except Exception:
                    temporary.unlink(missing_ok=True)
                    if attempt == 2:
                        raise
                    await asyncio.sleep(2 * (attempt + 1))
            await asyncio.sleep(0.3)
    print("Completed: 24 normal and 24 slower Chinese recordings.", flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true")
    arguments = parser.parse_args()
    asyncio.run(generate(arguments.force))
