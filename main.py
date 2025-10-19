from __future__ import annotations

import uvicorn
import json
from pathlib import Path
from typing import Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"
GRAPH_FILE = BASE_DIR / "graph.html"
JSON_DATA_DIR = BASE_DIR / "json_data"
ASSETS_DIR = BASE_DIR / "assets"


app = FastAPI(title="JsonMaker Backend", version="1.0.0")

# CORS for local dev and file:// opened pages; keep permissive for dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for assets
if ASSETS_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(ASSETS_DIR)), name="assets")


@app.get("/")
def serve_index() -> FileResponse:
    if not INDEX_FILE.exists():
        raise HTTPException(status_code=404, detail="index.html not found")
    return FileResponse(str(INDEX_FILE), media_type="text/html; charset=utf-8")


@app.get("/graph")
def serve_graph() -> FileResponse:
    if not GRAPH_FILE.exists():
        raise HTTPException(status_code=404, detail="graph.html not found")
    return FileResponse(str(GRAPH_FILE), media_type="text/html; charset=utf-8")


@app.post("/sync")
def sync_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Persist localStorage data onto the server filesystem.

    Expected JSON example:
    {
      "entriesByTopic": { "Topic A": [ {"id": "abc", "order": 1, ...} ] },
      "orderCounters": { "Topic A": 3 },
      "currentTopic": "Topic A"
    }
    """
    entries_by_topic = payload.get("entriesByTopic")
    if not isinstance(entries_by_topic, dict):
        raise HTTPException(
            status_code=400, detail="entriesByTopic is required and must be an object"
        )

    JSON_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Save per-topic files and a combined manifest
    saved_files = []
    for topic, entries in entries_by_topic.items():
        # Sanitize topic for filename
        safe_name = (
            "".join(c for c in topic if c.isalnum() or c in ("-", "_", " "))
            .strip()
            .replace(" ", "_")
        )
        if not safe_name:
            safe_name = "topic"
        path = JSON_DATA_DIR / f"{safe_name}.json"
        with path.open("w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
        saved_files.append(path.name)

    manifest = {
        "currentTopic": payload.get("currentTopic"),
        "orderCounters": payload.get("orderCounters", {}),
        "topicMeta": payload.get("topicMeta", {}),
        "topics": list(entries_by_topic.keys()),
        "files": saved_files,
    }
    with (JSON_DATA_DIR / "manifest.json").open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)

    return {"status": "ok", "saved": saved_files}


@app.get("/restore")
def restore_data() -> Dict[str, Any]:
    """Return last saved dataset from json_data directory.

    Combines per-topic files into entriesByTopic and loads manifest if present
    for currentTopic and orderCounters.
    """
    if not JSON_DATA_DIR.exists():
        return {"entriesByTopic": {}, "orderCounters": {}, "currentTopic": None}

    entries_by_topic: Dict[str, Any] = {}
    for path in JSON_DATA_DIR.glob("*.json"):
        if path.name == "manifest.json":
            continue
        topic_name = path.stem.replace("_", " ")
        try:
            entries = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            entries = []
        entries_by_topic[topic_name] = entries

    current_topic = None
    order_counters: Dict[str, int] = {}
    topic_meta: Dict[str, Any] = {}
    manifest_path = JSON_DATA_DIR / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            current_topic = manifest.get("currentTopic")
            order_counters = manifest.get("orderCounters") or {}
            topic_meta = manifest.get("topicMeta") or {}
        except Exception:
            pass

    return {
        "entriesByTopic": entries_by_topic,
        "orderCounters": order_counters,
        "currentTopic": current_topic,
        "topicMeta": topic_meta,
    }


if __name__ == "__main__":  # pragma: no cover
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
