
class EWMAMetricsManager {
  constructor() {
    this.hlsManager = null;
    this.uiManager = null;
    this.updateTimer = null;
    this.updateInterval = 1000; // 1 second
    this.isUpdating = false;
    
    // Data storage
    this.metricsData = {
      bitrateDownloading: [],
      ewmaBandwidth: []
    };
    
    this.timeLabels = [];
    this.maxDataPoints = 50;
    
    // 시작 시간을 고정하여 일관성 보장 (Fix start time to ensure consistency)
    this.fixedStartTime = null;
    this.startTime = null;
    
    // ✅ NEW: Network load and delay tracking
    this.chunkMetrics = {
      downloadedChunks: [], // Array of {size: bytes, delay: seconds}
      totalChunkSize: 0,
      totalChunkCount: 0,
      totalDelay: 0
    };
  }

  setManagers(hlsManager, uiManager) {
    this.hlsManager = hlsManager;
    this.uiManager = uiManager;
  }

  startUpdating() {
    // Clear any existing interval first
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    
    // 먼저 데이터를 완전히 클리어 - follow metrics-manager.js pattern
    this.clearData();
    
    // 차트 초기화
    if (window.chartManager) {
      window.chartManager.initChart();
    }

    // 고정된 시작 시간 설정 - ALWAYS set new time on startUpdating (like metrics-manager.js)
    this.fixedStartTime = Date.now();
    
    // 현재 작업용 시작 시간은 고정된 시작 시간을 사용
    this.startTime = this.fixedStartTime;
    
    // 1초마다 메트릭 업데이트
    this.isUpdating = true;
    this.updateTimer = setInterval(() => {
      this.updateMetrics();
    }, this.updateInterval);
  }

  stopUpdating() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
    this.isUpdating = false;
  }

  updateMetrics() {
    if (!this.isUpdating) {
      return;
    }
    
    if (!this.hlsManager.isAvailable()) {
      return;
    }

    // 시작 시간이 설정되지 않았다면 고정된 시작 시간으로 설정
    if (!this.startTime) {
      this.startTime = this.fixedStartTime;
    }

    // 경과 시간 계산 (고정된 시간 기준)
    const elapsedSeconds = Math.floor((Date.now() - this.fixedStartTime) / 1000);
    const elapsedTime = this.formatElapsedTime(elapsedSeconds);

    // 데이터 포인트 제한
    if (this.timeLabels.length >= this.maxDataPoints) {
      this.timeLabels.shift();
      Object.keys(this.metricsData).forEach(key => {
        this.metricsData[key].shift();
      });
    }

    this.timeLabels.push(elapsedTime);

    // Loaded Bitrate from FRAG_LOADED (shows bitrate of most recently loaded fragment)
    const loadedBitrate = this.hlsManager.getLoadedBitrate();
    
    // For chart data, use the same loaded bitrate (synchronized UI and chart)
    const currentPlayingBitrate = this.hlsManager.getCurrentPlayingBitrate();
    
    // Use loaded bitrate for both UI and chart data (synchronized values)
    this.metricsData.bitrateDownloading.push(loadedBitrate);
    
    if (this.uiManager) {
      // Update the Statistics UI with loaded bitrate (from FRAG_LOADED with 3s timeout)
      this.uiManager.updateLoadedBitrate(loadedBitrate + ' kbps');
    }

    // EWMA Bandwidth (prediction) - Get EWMA estimate from HLS.js
    const ewmaBandwidth = this.hlsManager.getEWMABandwidth();
    const roundedEwmaBandwidth = Math.round(ewmaBandwidth);
    this.metricsData.ewmaBandwidth.push(roundedEwmaBandwidth);
    
    // Update the UI chart display value immediately
    if (this.uiManager) {
      // Use the correct method names that exist in UI manager
      if (typeof this.uiManager.updateEWMABandwidthChart === 'function') {
        this.uiManager.updateEWMABandwidthChart(roundedEwmaBandwidth + ' kbps');
      }
    }

    // Update chart if available
    if (window.chartManager) {
      window.chartManager.updateChart();
    }
  }

  getMetricsData() {
    return this.metricsData;
  }

  getTimeLabels() {
    return this.timeLabels;
  }

  clearData() {
    this.timeLabels = [];
    // Note: fixedStartTime은 유지하고 startTime만 초기화하지 않음
    // this.startTime은 startUpdating()에서 fixedStartTime으로 재설정됨
    Object.keys(this.metricsData).forEach(key => {
      this.metricsData[key] = [];
    });
    
    // ✅ NEW: Clear chunk metrics
    this.chunkMetrics = {
      downloadedChunks: [],
      totalChunkSize: 0,
      totalChunkCount: 0,
      totalDelay: 0
    };
  }

  clearDataOnly() {
    // Clear metrics data and time labels BUT maintain the start time
    // This is used by the "Clear" button to maintain chart timeline
    // Same as clearData() now - both maintain fixedStartTime
    this.clearData();
    
    // Calculate how much time has elapsed for logging
    if (this.fixedStartTime) {
      const currentElapsedSeconds = Math.floor((Date.now() - this.fixedStartTime) / 1000);
    }
  }

  // 완전한 시간 리셋 (새로운 스트림 로드시 사용) - follow metrics-manager.js pattern
  resetFixedStartTime() {
    const oldTime = this.fixedStartTime;
    this.fixedStartTime = null;
    this.startTime = null;
  }

  // Return total elapsed time from current fixed start time
  getTotalElapsedTime() {
    if (!this.fixedStartTime) return 0;
    return Math.floor((Date.now() - this.fixedStartTime) / 1000);
  }

  // Format elapsed time as HH:MM:SS - follow metrics-manager.js format
  formatElapsedTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    const formatted = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    return formatted;
  }

  // Track chunk download and calculate network metrics
  onChunkDownloaded(chunkSize, estimatedBandwidth) {
    // Calculate delay: (chunk size in bytes) / (bandwidth in bps)
    const chunkSizeBytes = chunkSize || 0;
    const bandwidthBps = estimatedBandwidth * 1000; // Convert kbps to bps
    const delay = bandwidthBps > 0 ? (chunkSizeBytes * 8) / bandwidthBps : 0; // Convert bytes to bits, then divide by bps
    
    // 2. Update chunk metrics
    this.chunkMetrics.downloadedChunks.push({
      size: chunkSizeBytes,
      delay: delay
    });
    
    this.chunkMetrics.totalChunkSize += chunkSizeBytes;
    this.chunkMetrics.totalChunkCount += 1;
    this.chunkMetrics.totalDelay += delay;
    
    // 3. Calculate current values
    const networkLoad = chunkSizeBytes; // Current chunk size
    const averageNetworkLoad = this.chunkMetrics.totalChunkCount > 0 ? 
      this.chunkMetrics.totalChunkSize / this.chunkMetrics.totalChunkCount : 0;
    const currentDelay = delay;
    const averageDelay = this.chunkMetrics.totalChunkCount > 0 ? 
      this.chunkMetrics.totalDelay / this.chunkMetrics.totalChunkCount : 0;
    
    // Update UI if available
    if (this.uiManager) {
      if (typeof this.uiManager.updateNetworkLoad === 'function') {
        this.uiManager.updateNetworkLoad(Math.round(networkLoad / 1000) + ' kbytes');
      }
      if (typeof this.uiManager.updateAverageNetworkLoad === 'function') {
        this.uiManager.updateAverageNetworkLoad(Math.round(averageNetworkLoad / 1000) + ' kbytes');
      }
      if (typeof this.uiManager.updateDelay === 'function') {
        this.uiManager.updateDelay(currentDelay.toFixed(3) + ' s');
      }
      if (typeof this.uiManager.updateAverageDelay === 'function') {
        this.uiManager.updateAverageDelay(averageDelay.toFixed(3) + ' s');
      }
    }
  }

  destroy() {
    this.stopUpdating();
    this.clearData();
  }

  // Chart manager required methods
  getMetricsConfig() {
    return {
      bitrateDownloading: {
        label: 'Loaded Bitrate',
        color: '#007bff',
        yAxisID: 'sharedY'  // ✅ CHANGE: Use shared Y-axis for perfect alignment
      },
      ewmaBandwidth: {
        label: 'EWMA Bandwidth',
        color: 'rgb(255, 99, 132)',
        yAxisID: 'sharedY'  // ✅ CHANGE: Use shared Y-axis for perfect alignment
      }
    };
  }

  getActiveMetrics() {
    const metrics = [];
    const configs = [];
    const metricsConfig = this.getMetricsConfig();

    Object.keys(metricsConfig).forEach(key => {
      const checkbox = document.getElementById(key + 'Check');
      if (checkbox && checkbox.checked) {
        const config = metricsConfig[key];
        configs.push({ key, config });
        
        metrics.push({
          label: config.label,
          data: [...this.metricsData[key]],
          borderColor: config.color,
          backgroundColor: config.color + '20',
          fill: false,
          yAxisID: config.yAxisID,
          tension: 0.1
        });
      }
    });

    return { metrics, configs };
  }
}

// Export for global access
window.EWMAMetricsManager = EWMAMetricsManager;
