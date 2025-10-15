/**
 * UI Manager - UI 업데이트 및 이벤트 처리
 */
class UIManager {
  constructor() {
    this.elements = this.getElements();
  }

  getElements() {
    return {
      // Current Display Chunk Info
      currentLevelDisplay: document.getElementById('currentLevelDisplay'),
      semanticTypeDisplay: document.getElementById('semanticTypeDisplay'),
      semanticLevelDisplay: document.getElementById('semanticLevelDisplay'),
      semanticLabelText: document.getElementById('semanticLabelText'),
      semanticTypeText: document.getElementById('semanticTypeText'),
      privacyProtection: document.getElementById('privacyProtection'),
      dnnBwDisplay: document.getElementById('dnnBwDisplay'),
      ewmaBwDisplay: document.getElementById('ewmaBwDisplay'),
      chunkFileDisplay: document.getElementById('chunkFileDisplay'),

      // Statistics
      loadedBitrate: document.getElementById('loadedBitrate'),
      dnnBandwidthChart: document.getElementById('dnnBandwidthChart'),
      ewmaBandwidthChart: document.getElementById('ewmaBandwidthChart'),

      // Network load and delay evaluation elements
      networkLoadDisplay: document.getElementById('networkLoadDisplay'),
      averageNetworkLoadDisplay: document.getElementById('averageNetworkLoadDisplay'),
      delayDisplay: document.getElementById('delayDisplay'),
      averageDelayDisplay: document.getElementById('averageDelayDisplay'),

      // Input
      sourceUrl: document.getElementById('sourceUrl')
    };
  }

  // Current Display Chunk Info Updates
  updateCurrentLevel(value) {
    this.elements.currentLevelDisplay.textContent = value;
  }

  updateSemanticType(value) {
    if (this.elements.semanticTypeDisplay) {
      this.elements.semanticTypeDisplay.textContent = value;
    } else {
      console.error('semanticTypeDisplay element not found!');
    }
  }

  updateSemanticLevel(value) {
    if (this.elements.semanticLevelDisplay) {
      this.elements.semanticLevelDisplay.textContent = value;
    } else {
      console.error('semanticLevelDisplay element not found!');
    }
  }

  updateSemanticLabel(value, color = null) {
    if (this.elements.semanticLabelText) {
      this.elements.semanticLabelText.textContent = value;
      if (color) {
        this.elements.semanticLabelText.style.color = color;
        this.elements.semanticLabelText.style.fontWeight = 'bold';
      }
    } else {
      console.error('semanticLabelText element not found!');
    }
  }

  updateSemanticTypeText(value, color = null) {
    if (this.elements.semanticTypeText) {
      this.elements.semanticTypeText.textContent = value;
      if (color) {
        this.elements.semanticTypeText.style.color = color;
        this.elements.semanticTypeText.style.fontWeight = 'bold';
      }
    } else {
      console.error('semanticTypeText element not found!');
    }
  }

  updatePrivacyProtection(value, color = null) {
    if (this.elements.privacyProtection) {
      this.elements.privacyProtection.textContent = value;
      if (color) {
        this.elements.privacyProtection.style.color = color;
        this.elements.privacyProtection.style.fontWeight = 'bold';
      }
    } else {
      console.error('privacyProtection element not found!');
    }
  }

  updateDNNBandwidth(value) {
    this.elements.dnnBwDisplay.textContent = value;
  }

  updateChunkFile(value) {
    this.elements.chunkFileDisplay.textContent = value;
  }

  // Statistics Updates
  updateBufferLength(value) {
    this.elements.bufferLength.textContent = value;
  }

  // Statistics Updates - Loaded Bitrate (from FRAG_LOADED events)
  updateLoadedBitrate(value) {
    // This updates the Statistics "Loaded Bitrate" field
    // Shows bitrate of most recently loaded fragment
    if (this.elements.loadedBitrate) {
      this.elements.loadedBitrate.textContent = value;
    } else {
      console.warn('UI_MANAGER: loadedBitrate element not found');
    }
  }

  updateDNNBandwidthChart(value) {
    this.elements.dnnBandwidthChart.textContent = value;
  }

  updateEWMABandwidthChart(value) {
    if (this.elements.ewmaBandwidthChart) {
      this.elements.ewmaBandwidthChart.textContent = value;
    }
  }

  updateEWMABandwidth(value) {
    if (this.elements.ewmaBwDisplay) {
      this.elements.ewmaBwDisplay.textContent = value;
    }
  }

  updateDroppedFrames(value) {
    this.elements.droppedFrames.textContent = value;
  }

  updateIndexDownloading(value) {
    this.elements.indexDownloading.textContent = value;
  }

  updateIndexPlaying(value) {
    this.elements.indexPlaying.textContent = value;
  }

  updateLatency(value) {
    this.elements.latency.textContent = value;
  }

  updateDownloadTime(value) {
    this.elements.downloadTime.textContent = value;
  }

  updateRatio(value) {
    this.elements.ratio.textContent = value;
  }

  // Network load and delay evaluation updates
  updateNetworkLoad(value) {
    if (this.elements.networkLoadDisplay) {
      this.elements.networkLoadDisplay.textContent = value;
    }
  }

  updateAverageNetworkLoad(value) {
    if (this.elements.averageNetworkLoadDisplay) {
      this.elements.averageNetworkLoadDisplay.textContent = value;
    }
  }

  updateDelay(value) {
    if (this.elements.delayDisplay) {
      this.elements.delayDisplay.textContent = value;
    }
  }

  updateAverageDelay(value) {
    if (this.elements.averageDelayDisplay) {
      this.elements.averageDelayDisplay.textContent = value;
    }
  }

  // Input management
  getSourceUrl() {
    return this.elements.sourceUrl.value;
  }

  setSourceUrl(value) {
    this.elements.sourceUrl.value = value;
  }

  // Reset all values to default (only used metrics)
  resetAllValues() {
    // Statistics
    this.updateLoadedBitrate('0 kbps');
    this.updateDNNBandwidthChart('0 kbps');
    this.updateEWMABandwidthChart('0 kbps');
    this.updateEWMABandwidth('0 kbps');

    // Current Display Chunk Info
    this.updateCurrentLevel('-');
    this.updateSemanticType('-');
    this.updateSemanticLevel('-');
    this.updateSemanticLabel('-');
    this.updateSemanticTypeText('-');
    this.updatePrivacyProtection('-');
    this.updateDNNBandwidth('-');
    this.updateChunkFile('-');

    // Reset network load and delay evaluation
    this.updateNetworkLoad('-');
    this.updateAverageNetworkLoad('-');
    this.updateDelay('-');
    this.updateAverageDelay('-');
  }

  // Alias for compatibility
  clearUI() {
    this.resetAllValues();
  }

  // Event listeners setup
  setupEventListeners(appManager) {
    // Load Stream button
    const loadStreamBtn = document.getElementById('loadStreamBtn');
    if (loadStreamBtn) {
      loadStreamBtn.onclick = () => appManager.loadStream();
    }

    // Clear Stream button
    const clearStreamBtn = document.getElementById('clearStreamBtn');
    if (clearStreamBtn) {
      clearStreamBtn.onclick = () => appManager.clearStream();
    }

    // Clear Charts button
    const clearChartsBtn = document.getElementById('clearChartsBtn');
    if (clearChartsBtn) {
      clearChartsBtn.onclick = () => appManager.clearCharts();
    }

    // Disable Charts button
    const disableChartsBtn = document.getElementById('disableChartsBtn');
    if (disableChartsBtn) {
      disableChartsBtn.onclick = () => appManager.disableCharts();
    }

    // Enter key for URL input
    this.elements.sourceUrl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        appManager.loadStream();
      }
    });
  }
}
