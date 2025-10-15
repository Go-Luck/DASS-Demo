/**
 * EWMA App Manager - Application management for EWMA bandwidth estimation
 * To be used only with EWMA_CleanDASS.html
 */
class EWMAAppManager {
  constructor() {
    this.hlsManager = null;
    this.metricsManager = null;
    this.uiManager = null;
    this.video = null;
    
    this.init();
  }

  init() {
    // Get video element
    this.video = document.getElementById('video');
    if (!this.video) {
      console.error('EWMA-APP: Video element not found');
      return;
    }

    // Initialize managers in correct order
    this.hlsManager = new EWMAHLSManager(this.video);
    this.metricsManager = new EWMAMetricsManager();
    this.chartManager = new ChartManager();
    this.uiManager = new UIManager();

    // Set up manager relationships
    this.hlsManager.setManagers(this.metricsManager, this.uiManager);
    this.metricsManager.setManagers(this.hlsManager, this.uiManager);
    this.chartManager.setMetricsManager(this.metricsManager);

    // Connect EWMA bandwidth estimation to UI
    if (window.ewmaBandwidthEstimation) {
      window.ewmaBandwidthEstimation.setUIManager(this.uiManager);
    }

    // Initialize chart
    this.chartManager.initChart();

    // Set up UI event listeners
    this.uiManager.setupEventListeners(this);

    // Export managers globally for access from other components
    window.hlsManager = this.hlsManager;
    window.metricsManager = this.metricsManager;
    window.chartManager = this.chartManager;
    window.uiManager = this.uiManager;
    window.appManager = this;

    // Auto-load stream on initialization
    this.autoLoadStream();
  }

  autoLoadStream() {
    // Auto-load the default stream URL when page loads
    const sourceUrl = document.getElementById('sourceUrl').value;
    if (sourceUrl) {
      // Small delay to ensure all components are ready
      setTimeout(() => {
        try {
          this.hlsManager.loadStream(sourceUrl);
        } catch (error) {
          console.error('EWMA-APP: Error auto-loading stream:', error);
        }
      }, 500);
    }
  }

  loadStream() {
    const sourceUrl = document.getElementById('sourceUrl').value;
    if (!sourceUrl) {
      alert('Please enter a stream URL');
      return;
    }

    try {
      
      // Reset timeline for new Load Stream - follow metrics-manager.js pattern
      if (this.metricsManager) {
        this.metricsManager.resetFixedStartTime();
      }
      
      this.hlsManager.loadStream(sourceUrl);
    } catch (error) {
      console.error('EWMA-APP: Error loading stream:', error);
      alert('Error loading stream: ' + error.message);
    }
  }

  clearStream() {
    try {
      // Stop metrics updating
      if (this.metricsManager) {
        this.metricsManager.stopUpdating();
        // Use clearDataOnly to maintain start time from last Load Stream
        this.metricsManager.clearDataOnly();
      }

      // Clear HLS stream
      if (this.hlsManager) {
        this.hlsManager.clearStream();
      }

      // Clear UI
      if (this.uiManager) {
        this.uiManager.resetAllValues();
      }

      // Clear charts
      if (this.chartManager) {
        this.chartManager.clearCharts();
      }

      // Reset EWMA estimation
      if (window.ewmaBandwidthEstimation) {
        window.ewmaBandwidthEstimation.reset();
      }

    } catch (error) {
      console.error('EWMA-APP: Error clearing stream:', error);
    }
  }

  clearCharts() {
    try {
      // Clear only chart data but maintain start time
      if (this.metricsManager) {
        this.metricsManager.clearDataOnly();
      }
      
      if (this.chartManager) {
        this.chartManager.clearCharts();
      }
    } catch (error) {
      console.error('EWMA-APP: Error clearing charts:', error);
    }
  }

  disableCharts() {
    if (this.chartManager) {
      this.chartManager.disableCharts();
    }
  }

  destroy() {
    this.clearStream();
    
    if (this.hlsManager) {
      this.hlsManager.destroy();
    }
    if (this.metricsManager) {
      this.metricsManager.destroy();
    }
    if (this.chartManager) {
      this.chartManager.destroy();
    }
    if (window.ewmaBandwidthEstimation) {
      window.ewmaBandwidthEstimation.destroy();
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  window.ewmaAppManager = new EWMAAppManager();
});
