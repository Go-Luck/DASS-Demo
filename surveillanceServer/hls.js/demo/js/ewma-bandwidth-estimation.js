/**
 * EWMA Bandwidth Estimation - HLS.js built-in EWMA bandwidth estimator
 * To be used only with EWMA_CleanDASS.html
 * Follows the same pattern as index1.html
 */
class EWMABandwidthEstimation {
  constructor() {
    this.hlsInstance = null;
    this.lastEstimate = 0;
    this.uiManager = null;
    this.updateInterval = null;
    
    this.init();
  }
  
  setHLS(hlsInstance) {
    this.hlsInstance = hlsInstance;
  }
  
  setUIManager(uiManager) {
    this.uiManager = uiManager;
    this.startRegularUpdates();
  }
  
  startRegularUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    // Update every 1 second - same as index1.html
    this.updateInterval = setInterval(() => {
      this.updateEWMADisplay();
    }, 1000);
  }
  
  updateEWMADisplay() {
    if (this.hlsInstance && this.hlsInstance.abrController && this.hlsInstance.abrController.bwEstimator) {
      const estimate = this.hlsInstance.abrController.bwEstimator.getEstimate(); // in bits/sec
      const kbps = (estimate / 1000).toFixed(2);
      this.lastEstimate = parseFloat(kbps);
      
      // Update EWMA bandwidth display in UI - exactly like index1.html
      if (this.uiManager && typeof this.uiManager.updateEWMABandwidth === 'function') {
        this.uiManager.updateEWMABandwidth(kbps + ' kbps');
      }
    }
  }
  
  init() {
    // Initialize - no custom EWMA needed, using HLS.js built-in
    this.lastEstimate = 0;
  }
  
  // Get current EWMA bandwidth estimate in kbps - from HLS.js built-in estimator
  getEstimateKbps() {
    if (this.hlsInstance && this.hlsInstance.abrController && this.hlsInstance.abrController.bwEstimator) {
      const estimate = this.hlsInstance.abrController.bwEstimator.getEstimate(); // in bits/sec
      return estimate / 1000; // Convert to kbps
    }
    return this.lastEstimate || 0;
  }
  
  // Get current EWMA bandwidth estimate in bps - from HLS.js built-in estimator  
  getEstimate() {
    if (this.hlsInstance && this.hlsInstance.abrController && this.hlsInstance.abrController.bwEstimator) {
      return this.hlsInstance.abrController.bwEstimator.getEstimate(); // in bits/sec
    }
    return this.lastEstimate * 1000 || 0; // Convert kbps to bps
  }
  
  // Check if we have enough data to provide an estimate
  canEstimate() {
    if (this.hlsInstance && this.hlsInstance.abrController && this.hlsInstance.abrController.bwEstimator) {
      return this.hlsInstance.abrController.bwEstimator.canEstimate();
    }
    return this.lastEstimate > 0;
  }
  
  // Reset the estimator
  reset() {
    this.lastEstimate = 0;
    if (this.hlsInstance && this.hlsInstance.abrController && this.hlsInstance.abrController.resetEstimator) {
      this.hlsInstance.abrController.resetEstimator();
    }
  }
  
  destroy() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.reset();
  }
}

// Global instance for EWMA bandwidth estimation
window.ewmaBandwidthEstimation = new EWMABandwidthEstimation();
