"""Load project config from config/config.yaml. Import this instead of hardcoding paths."""
from __future__ import annotations
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[2]

def load_config(path: str | Path = "config/config.yaml") -> dict:
    """Return the parsed config dict. Paths in it are relative to the repo root."""
    with open(ROOT / path) as f:
        return yaml.safe_load(f)

def resolve(rel: str | Path) -> Path:
    """Resolve a repo-relative path to an absolute Path."""
    return (ROOT / rel).resolve()
