"""Load project config from config/config.yaml. Import this instead of hardcoding paths."""
from __future__ import annotations
import os
from pathlib import Path
import yaml

# Repo root. Normally inferred from this file's location (src/silentguard/config.py ->
# two levels up), which is correct for a source checkout or an editable install.
#
# In a container the package is installed non-editably into site-packages, where that
# inference points at the Python lib directory instead of the app. SILENTGUARD_ROOT lets
# the deployment state the root explicitly; see deploy/hf-space/Dockerfile.
ROOT = Path(os.environ.get("SILENTGUARD_ROOT") or Path(__file__).resolve().parents[2]).resolve()


def load_config(path: str | Path = "config/config.yaml") -> dict:
    """Return the parsed config dict. Paths in it are relative to the repo root."""
    with open(ROOT / path) as f:
        return yaml.safe_load(f)


def resolve(rel: str | Path) -> Path:
    """Resolve a repo-relative path to an absolute Path."""
    return (ROOT / rel).resolve()
