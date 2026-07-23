"""Grad-CAM style temporal saliency for the 1-D CNN half of the frozen ensemble.

The SHAP explanations in :mod:`silentguard.explain.explain` answer *which feature*
drove a verdict. This module answers the complementary question a clinician actually
asks: *where in the waveform* did the network look?

The frozen engine's deep model is :class:`Conv1DNet` — four conv blocks followed by a
global average pool. Because the pool sits directly on the last feature map, Grad-CAM
over that map is exact rather than an approximation: the channel weights obtained by
averaging the gradients are precisely the head's sensitivity to each feature channel.

Returned saliency is normalized to 0..1 over the analysis window and upsampled back to
the raw sample rate so it can be drawn straight onto the displayed ECG.
"""
from __future__ import annotations
import numpy as np


def gradcam_1d(model, x_row: np.ndarray, target: int | None = None) -> dict:
    """Temporal Grad-CAM for one record's ``[3, T]`` waveform tensor.

    Args:
        model: a trained ``Conv1DNet`` (or any module exposing ``.features``).
        x_row: the record's channel tensor, shape ``[3, T]``, as fed to the CNN.
        target: class index to explain — ``1`` = evidence the alarm is TRUE,
            ``0`` = evidence it is FALSE. ``None`` uses the model's own prediction.

    Returns:
        ``{"saliency": [T] float 0..1, "target": int, "p_true": float,
        "n_conv_steps": int}``.
    """
    import torch

    was_training = model.training
    model.eval()

    x = torch.as_tensor(np.asarray(x_row, dtype=np.float32))[None]  # [1, 3, T]
    T = x.shape[-1]

    captured: dict = {}

    def _hook(_module, _inp, out):
        out.retain_grad()
        captured["a"] = out

    handle = model.features.register_forward_hook(_hook)
    try:
        with torch.enable_grad():
            logits = model(x)
            p_true = float(torch.softmax(logits.detach(), dim=1)[0, 1])
            tgt = int(torch.argmax(logits.detach(), dim=1)[0]) if target is None else int(target)
            model.zero_grad(set_to_none=True)
            logits[0, tgt].backward()
        acts = captured["a"].detach()[0]          # [C, L]
        grads = captured["a"].grad.detach()[0]    # [C, L]
    finally:
        handle.remove()
        if was_training:
            model.train()

    weights = grads.mean(dim=1, keepdim=True)                 # [C, 1]
    cam = torch.relu((weights * acts).sum(dim=0)).numpy()     # [L]

    # upsample the coarse conv-resolution map back onto the raw timebase
    L = len(cam)
    if L < 2:
        full = np.zeros(T, dtype=float)
    else:
        full = np.interp(np.linspace(0.0, L - 1.0, T), np.arange(L), cam)

    span = float(full.max() - full.min())
    full = (full - full.min()) / span if span > 1e-12 else np.zeros_like(full)

    return {
        "saliency": full.astype(float),
        "target": tgt,
        "p_true": p_true,
        "n_conv_steps": int(L),
    }


def saliency_for_record(rec, cnn_model, cfg: dict, target: int | None = None) -> dict:
    """Convenience wrapper: build a record's CNN input, then Grad-CAM it.

    Args:
        rec: an :class:`~silentguard.data.io.AlarmRecord`.
        cnn_model: the frozen ensemble's ``cnn`` attribute.
        cfg: the loaded project config.
        target: see :func:`gradcam_1d`.

    Returns:
        The :func:`gradcam_1d` dict plus ``window_seconds`` and ``fs``.
    """
    from ..models.cnn import record_to_channels

    x = record_to_channels(rec, cfg)
    out = gradcam_1d(cnn_model, x, target=target)
    out["window_seconds"] = float(cfg["signal"]["window_seconds"])
    out["fs"] = int(cfg["signal"]["fs"])
    return out
