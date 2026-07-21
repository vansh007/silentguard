"""Deep models on raw waveforms: 1D-CNN, then attention CNN-LSTM.

Build-order step 6. Attention weights double as explainability. Keep windows short
(~10-16 s @ 250 Hz) so this trains on a single GPU (Colab/Kaggle free tier is enough).
"""
from __future__ import annotations
import torch
import torch.nn as nn


class WaveformCNN(nn.Module):
    """1D-CNN over multi-channel waveform. TODO: conv blocks -> global pool -> FC -> logit."""
    def __init__(self, in_channels: int = 3, n_classes: int = 1):
        super().__init__()
        raise NotImplementedError

    def forward(self, x):  # x: (batch, channels, samples)
        raise NotImplementedError


# TODO later: AttentionCNNLSTM with an attention layer whose weights are returned for explain/.
