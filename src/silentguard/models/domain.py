"""Domain generalization + few-shot local calibration (contributions C1 and the India E6).

- generalize(): reduce the train(2015) -> test(VTaC) gap without target labels
  (per-record normalization, domain-adversarial training, or robust SQI features).
- few_shot_calibrate(): fine-tune a 2015-trained model on k labeled target alarms and
  report score-vs-k. This produces the "how much local data does an Indian ICU need?" curve.
"""
from __future__ import annotations
import numpy as np


def generalize(model, X_src, y_src, cfg: dict):
    """Train with a domain-generalization objective. TODO."""
    raise NotImplementedError


def few_shot_calibrate(model, X_target, y_target, k_values=(0, 10, 25, 50, 100), cfg: dict | None = None) -> dict:
    """Return {k: metrics} learning curve. TODO: sample k target labels, fine-tune, evaluate."""
    raise NotImplementedError
