"""Per-alarm explanations for clinician trust. Build-order step 9.

- Feature model: SHAP values -> top reasons ("low PPG SQI + ECG/ABP HR mismatch").
- Deep model: attention weights / Grad-CAM -> highlight the waveform region.
"""
from __future__ import annotations
import numpy as np


def explain_features(model, x_row: np.ndarray, feature_names: list[str], k: int = 3) -> list[tuple[str, float]]:
    """Top-k SHAP reasons for one prediction. TODO."""
    raise NotImplementedError


def explain_waveform(model, x_waveform: np.ndarray) -> np.ndarray:
    """Per-sample importance (attention/Grad-CAM) aligned to the input. TODO."""
    raise NotImplementedError
