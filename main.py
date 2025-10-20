from __future__ import annotations

import uvicorn
import json
import zipfile
import time
from pathlib import Path
from typing import Dict, Any
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


BASE_DIR = Path(__file__).resolve().parent
INDEX_FILE = BASE_DIR / "index.html"
GRAPH_FILE = BASE_DIR / "graph.html"
JSON_DATA_DIR = BASE_DIR / "json_data"
GRAPH_DATA_DIR = JSON_DATA_DIR / "graph"
ASSETS_DIR = BASE_DIR / "assets"
BACKUPS_DIR = BASE_DIR / "backups"
BACKUP_METADATA_FILE = BACKUPS_DIR / "backup_metadata.json"


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
        "booksMeta": payload.get("booksMeta", {}),
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
        # Skip manifest and graph_data (graph_data should be in graph/ folder now)
        if path.name in ("manifest.json", "graph_data.json"):
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
    books_meta: Dict[str, Any] = {}
    manifest_path = JSON_DATA_DIR / "manifest.json"
    if manifest_path.exists():
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            current_topic = manifest.get("currentTopic")
            order_counters = manifest.get("orderCounters") or {}
            topic_meta = manifest.get("topicMeta") or {}
            books_meta = manifest.get("booksMeta") or {}
        except Exception:
            pass

    return {
        "entriesByTopic": entries_by_topic,
        "orderCounters": order_counters,
        "currentTopic": current_topic,
        "topicMeta": topic_meta,
        "booksMeta": books_meta,
    }


@app.post("/sync_graph")
def sync_graph_data(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Persist graph connections and books metadata to the server.

    Expected JSON example:
    {
      "booksMeta": { "Topic A": {"id": "doc_abc12345", "name": "Topic A", ...} },
      "graphConnections": { "doc_abc12345": [ {...connection objects...} ] }
    }
    """
    books_meta = payload.get("booksMeta")
    graph_connections = payload.get("graphConnections")

    if not isinstance(books_meta, dict):
        raise HTTPException(
            status_code=400, detail="booksMeta is required and must be an object"
        )

    # Create graph directory if it doesn't exist
    GRAPH_DATA_DIR.mkdir(parents=True, exist_ok=True)

    # Save graph connections to graph/graph_data.json
    graph_data_path = GRAPH_DATA_DIR / "graph_data.json"
    graph_data = {
        "booksMeta": books_meta,
        "graphConnections": graph_connections or {},
        "lastSync": json.loads(json.dumps({}))  # Timestamp placeholder
    }
    with graph_data_path.open("w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)

    return {"status": "ok", "message": "Graph data synced successfully"}


@app.get("/restore_graph")
def restore_graph_data() -> Dict[str, Any]:
    """Return saved graph connections and books metadata.

    Returns booksMeta and graphConnections from graph/graph_data.json if it exists.
    """
    graph_data_path = GRAPH_DATA_DIR / "graph_data.json"

    if not graph_data_path.exists():
        return {"booksMeta": {}, "graphConnections": {}}

    try:
        graph_data = json.loads(graph_data_path.read_text(encoding="utf-8"))
        return {
            "booksMeta": graph_data.get("booksMeta", {}),
            "graphConnections": graph_data.get("graphConnections", {})
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading graph data: {str(e)}")


def get_backup_metadata() -> Dict[str, Any]:
    """Load backup metadata from file."""
    if not BACKUP_METADATA_FILE.exists():
        return {"backups": [], "last_backup_time": 0}

    try:
        return json.loads(BACKUP_METADATA_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"backups": [], "last_backup_time": 0}


def save_backup_metadata(metadata: Dict[str, Any]) -> None:
    """Save backup metadata to file."""
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)
    with BACKUP_METADATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)


def cleanup_old_backups(metadata: Dict[str, Any]) -> None:
    """Keep only the 5 most recent backups."""
    backups = metadata.get("backups", [])

    # Sort by timestamp descending (newest first)
    backups.sort(key=lambda x: x.get("timestamp", 0), reverse=True)

    # Keep only the 5 most recent
    backups_to_keep = backups[:5]
    backups_to_delete = backups[5:]

    # Delete old backup files
    for backup in backups_to_delete:
        backup_file = BACKUPS_DIR / backup.get("filename", "")
        if backup_file.exists():
            try:
                backup_file.unlink()
            except Exception as e:
                print(f"Error deleting old backup {backup_file}: {e}")

    # Update metadata with only the backups we're keeping
    metadata["backups"] = backups_to_keep


@app.post("/backup")
def create_backup() -> Dict[str, Any]:
    """Create a ZIP backup of all data in json_data directory.

    Features:
    - Creates timestamped ZIP files in backups/ directory
    - Keeps only the 5 most recent backups
    - Prevents spamming: enforces 1-minute cooldown between backups
    """
    # Load metadata
    metadata = get_backup_metadata()

    # Check cooldown (1 minute = 60 seconds)
    current_time = time.time()
    last_backup_time = metadata.get("last_backup_time", 0)
    cooldown_seconds = 60

    if current_time - last_backup_time < cooldown_seconds:
        remaining = int(cooldown_seconds - (current_time - last_backup_time))
        raise HTTPException(
            status_code=429,
            detail=f"لطفاً {remaining} ثانیه صبر کنید قبل از گرفتن بک‌آپ بعدی"
        )

    # Check if json_data exists
    if not JSON_DATA_DIR.exists():
        raise HTTPException(
            status_code=404,
            detail="دایرکتوری json_data یافت نشد"
        )

    # Create backups directory
    BACKUPS_DIR.mkdir(parents=True, exist_ok=True)

    # Generate backup filename with timestamp
    timestamp = datetime.now()
    timestamp_str = timestamp.strftime("%Y-%m-%d_%H-%M-%S")
    backup_filename = f"backup_{timestamp_str}.zip"
    backup_path = BACKUPS_DIR / backup_filename

    try:
        # Create ZIP file
        with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            # Walk through json_data directory
            for file_path in JSON_DATA_DIR.rglob('*'):
                if file_path.is_file():
                    # Add file to ZIP with relative path
                    arcname = file_path.relative_to(JSON_DATA_DIR)
                    zipf.write(file_path, arcname)

        # Update metadata
        metadata["backups"].append({
            "filename": backup_filename,
            "timestamp": current_time,
            "timestamp_str": timestamp_str,
            "size_bytes": backup_path.stat().st_size
        })
        metadata["last_backup_time"] = current_time

        # Cleanup old backups (keep only 5 most recent)
        cleanup_old_backups(metadata)

        # Save metadata
        save_backup_metadata(metadata)

        return {
            "status": "ok",
            "message": "بک‌آپ با موفقیت ایجاد شد",
            "filename": backup_filename,
            "timestamp": timestamp_str,
            "backups_count": len(metadata["backups"])
        }

    except Exception as e:
        # Clean up failed backup file if it exists
        if backup_path.exists():
            backup_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"خطا در ایجاد بک‌آپ: {str(e)}"
        )


if __name__ == "__main__":  # pragma: no cover
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
