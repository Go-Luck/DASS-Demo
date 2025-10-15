/**
 * EWMA HLS Manager - HLS management specifically for EWMA bandwidth estimation
 * To be used only with EWMA_CleanDASS.html
 */
class EWMAHLSManager {
  constructor(video) {
    this.hls = null;
    this.video = video;
    this.metricsManager = null;
    this.uiManager = null;
    this.lastSemanticUpdate = 0;
    this.semanticUpdateInterval = 1000; // 1 second
    this.isDownloading = false; // Track if currently downloading a fragment
    this.downloadTimeout = null; // Timeout to reset loading bitrate
    this.downloadTimeoutDuration = 1000; // 1 second timeout for loading bitrate reset

    // Track current loaded fragment info
    this.currentLoadedBitrate = 0; // Bitrate of most recently loaded fragment
    this.currentLoadedChunkFile = ''; // Chunk file name of most recently loaded fragment
    this.currentPlayingChunkFile = ''; // Chunk file name of currently playing fragment
    
    // Track fragments loaded in last 1 second (for chart data)
    this.loadedFragments = []; // Array of {bitrate, timestamp}
    this.loadedBitrateWindow = 1000; // 1 second window
    
    // Track chunk sizes for network load calculations
    this.currentChunkSize = 0; // Size of most recently loaded chunk in bytes
    this.chunkSizes = []; // Array of {size: bytes, timestamp: ms}
    
    // Bind video event handlers for proper cleanup
    this.handleVideoEnded = this.handleVideoEnded.bind(this);
    this.handleVideoError = this.handleVideoError.bind(this);
    
    // Flag to prevent duplicate subtitle tracks
    this.subtitleTrackCreated = false;
  }

  setManagers(metricsManager, uiManager) {
    this.metricsManager = metricsManager;
    this.uiManager = uiManager;
  }

  isAvailable() {
    return this.hls && this.video;
  }

  getLoadedBitrate() {
    // Returns the bitrate of the most recently loaded fragment (from FRAG_LOADED)
    return this.currentLoadedBitrate;
  }

  // Get the size of the most recently loaded chunk
  getLastChunkSize() {
    return this.currentChunkSize;
  }

  getChartLoadedBitrate() {
    // Returns the bitrate of the fragment loaded most recently within last 1 second (for chart)
    this.cleanOldFragments();
    
    if (this.loadedFragments.length === 0) {
      return 0;
    }
    
    // Return the bitrate of the most recently loaded fragment (within 1 second window)
    const latestFragment = this.loadedFragments[this.loadedFragments.length - 1];
    const timeSinceLoad = Date.now() - latestFragment.timestamp;
    
    // Extra check: if more than 1 second has passed since last fragment, return 0
    if (timeSinceLoad > this.loadedBitrateWindow) {
      return 0;
    }
    
    return latestFragment.bitrate;
  }

  addLoadedFragment(bitrate) {
    // Add a new loaded fragment with current timestamp
    const now = Date.now();
    this.loadedFragments.push({
      bitrate: bitrate,
      timestamp: now
    });
    
    // Clean old fragments immediately after adding
    this.cleanOldFragments();
  }

  cleanOldFragments() {
    // Remove fragments older than 1 second
    const now = Date.now();
    const cutoffTime = now - this.loadedBitrateWindow;
    
    const originalLength = this.loadedFragments.length;
    this.loadedFragments = this.loadedFragments.filter(frag => frag.timestamp >= cutoffTime);
    
  }


  resetLoadingBitrate() {
    this.isDownloading = false;
    this.currentLoadedBitrate = 0;
    this.currentLoadedChunkFile = '';
    if (this.downloadTimeout) {
      clearTimeout(this.downloadTimeout);
      this.downloadTimeout = null;
    }
    // Also clear loaded fragments when resetting
    this.loadedFragments = [];
  }

  setDownloadTimeout() {
    // Clear existing timeout
    if (this.downloadTimeout) {
      clearTimeout(this.downloadTimeout);
    }
    
    // Set new timeout to reset loaded bitrate if no new FRAG_LOADED in 1 seconds
    this.downloadTimeout = setTimeout(() => {
      this.resetLoadingBitrate();
    }, this.downloadTimeoutDuration);
  }

  getCurrentBitrate() {
    // Alias for getCurrentPlayingBitrate for compatibility
    return this.getCurrentPlayingBitrate();
  }

  getCurrentPlayingBitrate() {
    // Returns the bitrate of the currently playing quality level
    if (!this.hls || !this.hls.levels) return 0;
    
    try {
      const currentLevel = this.hls.currentLevel;
      if (currentLevel >= 0 && this.hls.levels[currentLevel]) {
        return Math.round(this.hls.levels[currentLevel].bitrate / 1000); // Convert to kbps
      }
      return 0;
    } catch (error) {
      console.error('Error getting current playing bitrate:', error);
      return 0;
    }
  }

  // EWMA bandwidth estimation using HLS.js built-in estimator
  getEWMABandwidth() {
    try {
      // Method 1: Direct access to abrController.bwEstimator
      if (this.hls.abrController && this.hls.abrController.bwEstimator) {
        const estimate = this.hls.abrController.bwEstimator.getEstimate(); // in bits/sec
        return estimate / 1000; // Convert to kbps
      }
      
    } catch (error) {
      console.error('Error getting EWMA bandwidth:', error);
    }
    return 0;
  }

  loadStream(url) {
    if (Hls.isSupported()) {
      this.hls = new Hls({
        debug: false,
        
        // Buffer settings for near real-time - same as index1.html
        maxBufferLength: 1,
        maxMaxBufferLength: 1,
        backBufferLength: 0,
        
        // EWMA settings for recent value sensitivity - same as index1.html
        abrEwmaFastVoD: 0.1,
        abrEwmaSlowVoD: 1.0,
        
        lowLatencyMode: false,
        enableWorker: true,
        startLevel: -1,
        capLevelToPlayerSize: true,
        
        // Completely disable HLS.js subtitle handling
        enableWebVTT: false,
        enableIMSC1: false,
        enableCEA708Captions: false
      });

      this.hls.loadSource(url);
      this.hls.attachMedia(this.video);
      this.setupEventHandlers();
      this.setupVideoEventHandlers(); // Add video event handlers
      
      // Make globally accessible for subtitle testing
      window.hlsManager = this;
      
      // Connect HLS instance to EWMA estimation - same pattern as index1.html
      if (window.ewmaBandwidthEstimation) {
        window.ewmaBandwidthEstimation.setHLS(this.hls);
      }
    } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.video.src = url;
      this.setupVideoEventHandlers(); // Add video event handlers for direct playback too
    }
  }

  setupVideoEventHandlers() {
    // Add video event listeners to handle playback state changes
    this.video.addEventListener('ended', this.handleVideoEnded);
    this.video.addEventListener('error', this.handleVideoError);
    // Removed pause handler - don't reset loading bitrate when video paused
  }

  handleVideoEnded() {
    console.log('VIDEO_ENDED: Video playback finished');
    this.resetLoadingBitrate();
  }

  handleVideoError() {
    console.log('VIDEO_ERROR: Video error occurred, resetting state');
    this.resetLoadingBitrate();
  }

  setupEventHandlers() {
    
    this.hls.on(Hls.Events.ERROR, (event, data) => {
      // Handle subtitle errors (non-critical)
      if (data.details && (data.details.includes('subtitle') || data.details.includes('SUBTITLE') || 
          (data.url && data.url.includes('.vtt')))) {
        console.warn('Subtitle error (non-critical):', data.details);
        return; // Don't process as fatal error
      }
      
      console.error('HLS-MANAGER: HLS Error:', data);
      
      // Reset loading state on fragment loading errors
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.details.includes('FRAG')) {
        this.resetLoadingBitrate();
      }
      
      // Handle buffer append errors specifically
      if (data.details === 'bufferAppendError') {
        console.log('HLS-MANAGER: Buffer append error - attempting recovery');
        try {
          this.hls.recoverMediaError();
        } catch (e) {
          console.error('HLS-MANAGER: Failed to recover from buffer append error:', e);
        }
        return;
      }
      
      if (data.fatal) {
        console.error('HLS-MANAGER: Fatal error detected:', data.type);
        this.resetLoadingBitrate(); // Reset on fatal errors
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.log('HLS-MANAGER: Attempting network error recovery');
            this.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('HLS-MANAGER: Attempting media error recovery');
            this.hls.recoverMediaError();
            break;
          default:
            console.log('HLS-MANAGER: Unrecoverable error, destroying HLS instance');
            this.hls.destroy();
            break;
        }
      }
    });



    this.hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
      if (this.uiManager) {
        // Don't call updateTargetLevel - method doesn't exist in UI-Manager
      }
    });

    // Rate-limited semantic update on fragment change
    this.hls.on(Hls.Events.FRAG_CHANGED, (event, data) => {
      const now = Date.now();
      if (now - this.lastSemanticUpdate < this.semanticUpdateInterval) {
        return; // Skip update due to rate limiting
      }
      this.lastSemanticUpdate = now;
      
      const frag = data.frag;
      // Track current playing chunk file
      this.currentPlayingChunkFile = frag.relurl || 'unknown';
      
      let semanticLevel = 0, semanticType = 0, privacy = 0;
      
      if (frag.tagList && Array.isArray(frag.tagList)) {
        frag.tagList.forEach(tag => {
          if (Array.isArray(tag) && tag.length >= 2) {
            const [tagName, tagValue] = tag;
            switch (tagName) {
              case 'EXT-X-SEMANTICLEVEL':
                semanticLevel = parseFloat(tagValue) || 0;
                break;
              case 'EXT-X-SEMANTICTYPE':
                semanticType = parseFloat(tagValue) || 0;
                break;
              case 'EXT-X-PRIVACY':
                privacy = parseFloat(tagValue) || 0;
                break;
            }
          }
        });
      }
      
      this.updateCurrentUI(frag, semanticLevel, semanticType, privacy);
    });

    this.hls.on(Hls.Events.FRAG_LOADING, (event, data) => {
      // Fragment started loading - just track download state
      const frag = data.frag;
      const levelIndex = frag.level;
      
      if (this.hls.levels && this.hls.levels[levelIndex]) {
        this.isDownloading = true;
        
        // Clear any existing timeout since we're actively downloading
        if (this.downloadTimeout) {
          clearTimeout(this.downloadTimeout);
          this.downloadTimeout = null;
        }
      }
    });

    this.hls.on(Hls.Events.FRAG_LOADED, (event, data) => {
      // Fragment loaded event - set loaded bitrate and start 1s timeout
      const frag = data.frag;
      let semanticLevel = 0, semanticType = 0, privacy = 0;
      const chunkFile = frag.relurl || 'unknown';
      
      // Track chunk size from fragment data (using most reliable method)
      const chunkSize = frag.stats.total;
      
      this.currentChunkSize = chunkSize;
      this.chunkSizes.push({
        size: chunkSize,
        timestamp: Date.now()
      });
      
      // Track loaded fragment bitrate for UI display and chart data
      const levelIndex = frag.level;
      if (this.hls.levels && this.hls.levels[levelIndex]) {
        const loadedBitrate = Math.round(this.hls.levels[levelIndex].bitrate / 1000); // Convert to kbps
        
        // Set current loaded bitrate for UI display
        this.currentLoadedBitrate = loadedBitrate;
        this.currentLoadedChunkFile = chunkFile;
        this.isDownloading = false;
        
        // Add to loaded fragments tracking (for chart data)
        this.addLoadedFragment(loadedBitrate);

        // Start 1-second timeout to reset loaded bitrate if no new fragments
        this.setDownloadTimeout();
      }

      // Update EWMA bandwidth estimation with fragment data FIRST
      this.updateEWMAEstimation(data);
      
      // ✅ Apply bandwidth-based subtitle control after bandwidth update
      this.controlSubtitlesByBandwidth();
      
      // Notify metrics manager about chunk download with newly updated estimated bandwidth
      if (this.metricsManager && typeof this.metricsManager.onChunkDownloaded === 'function') {
        const estimatedBandwidth = this.getEWMABandwidth(); // Get freshly updated estimated bandwidth in kbps
        this.metricsManager.onChunkDownloaded(chunkSize, estimatedBandwidth);
      }
      
      // MetricsManager updates automatically via its own timer
    });

    // Create subtitle track on manifest parsed instead
    this.hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
      if (this.uiManager) {
        // Don't call updateTotalLevels - method doesn't exist in UI-Manager
      }
      
      // Start metrics updating which initializes the chart
      if (this.metricsManager) {
        this.metricsManager.startUpdating();
      }
      
      // Create our subtitle track after manifest is ready
      this.createSingleWorkingTrack();
    });

  }

  updateEWMAEstimation(data) {
    try {
      // Extract fragment download statistics
      const { stats } = data;
      if (stats && stats.loading && stats.loaded) {
        const downloadTime = stats.loading.end - stats.loading.start;
        const bytesLoaded = stats.loaded;
        
        // Feed data to our EWMA estimator
        if (window.ewmaBandwidthEstimation) {
          window.ewmaBandwidthEstimation.addSample(downloadTime, bytesLoaded);
        }
      }
    } catch (error) {
      console.error('EWMA ESTIMATION: Error updating estimation:', error);
    }
  }

  updateCurrentUI(frag, semanticLevel, semanticType, privacy) {
    const levelIndex = frag.level;
    const relurl = frag.relurl || 'unknown';
    
    // Get level info for display
    let levelInfo = 'Level ' + levelIndex;
    if (this.hls.levels && this.hls.levels[levelIndex]) {
      const levelObj = this.hls.levels[levelIndex];
      const width = levelObj.width || '?';
      const height = levelObj.height || '?';
      const bitrate = levelObj.bitrate ? (levelObj.bitrate / 1000).toFixed(0) : '?';
      levelInfo =  width + 'x' + height + ', ' + bitrate + ' kbps';
    }

    if (this.uiManager) {
      try {
        // Update Current Display Chunk Info
        if (typeof this.uiManager.updateCurrentLevel === 'function') {
          this.uiManager.updateCurrentLevel(levelInfo);
        }
        if (typeof this.uiManager.updateSemanticType === 'function') {
          this.uiManager.updateSemanticType(semanticType.toFixed(2));
        }
        if (typeof this.uiManager.updateSemanticLevel === 'function') {
          this.uiManager.updateSemanticLevel(semanticLevel.toFixed(2));
        }
        if (typeof this.uiManager.updateChunkFile === 'function') {
          this.uiManager.updateChunkFile(relurl);
        }

        // Update semantic labels and privacy
        const semanticInfo = this.getSemanticLabel(semanticLevel);
        if (typeof this.uiManager.updateSemanticLabel === 'function') {
          this.uiManager.updateSemanticLabel(semanticInfo.label, semanticInfo.color);
        }
        
        const typeInfo = this.getSemanticTypeText(semanticType);
        if (typeof this.uiManager.updateSemanticTypeText === 'function') {
          this.uiManager.updateSemanticTypeText(typeInfo.label, typeInfo.color);
        }
        
        const privacyInfo = this.getPrivacyText(privacy);
        if (typeof this.uiManager.updatePrivacyProtection === 'function') {
          this.uiManager.updatePrivacyProtection(privacyInfo.label, privacyInfo.color);
        }

        // ✅ Automatic subtitle control based on bandwidth
        // Show subtitles when bandwidth < 3000 kbps, hide when bandwidth >= 3000 kbps
        this.controlSubtitlesByBandwidth();

      } catch (error) {
        console.error('HLS-MANAGER: Error updating current UI via UI-Manager:', error);
      }
    }
  }

  // Semantic data mapping functions
  getSemanticLabel(semanticLevel) {
    switch (semanticLevel) {
      case 0:
        return { label: '평온', color: '#4CAF50'};
      case 1:
        return { label: '위험', color: '#FF9800'};
      case 2:
        return { label: '사고', color: '#F44336'};
      default:
        return { label: '알 수 없음', color: '#9E9E9E'};
    }
  }

  getSemanticTypeText(semanticType) {
    switch (semanticType) {
      case 0:
        return { label: '일반', color: '#4CAF50' };
      case 1:
        return { label: '폭행', color: '#FFC107' };
      case 2:
        return { label: '실신', color: '#F44336' };
      default:
        return { label: '알 수 없음', color: '#9E9E9E' };
    }
  }

  getPrivacyText(privacy) {
    switch (privacy) {
      case 0:
        return { label: '보호 안함', color: '#4CAF50' };
      case 1:
        return { label: '보호 됨', color: '#F44336' };
      default:
        return { label: '알 수 없음', color: '#9E9E9E' };
    }
  }

  clearStream() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
    
    // Remove video event listeners to prevent memory leaks
    if (this.video) {
      this.video.removeEventListener('ended', this.handleVideoEnded);
      this.video.removeEventListener('error', this.handleVideoError);
      this.video.src = '';
    }
    
    // Reset loading bitrate and download state
    this.resetLoadingBitrate();
    
    // Reset subtitle track flag
    this.subtitleTrackCreated = false;
    
    // Reset EWMA estimator
    if (window.ewmaBandwidthEstimation) {
      window.ewmaBandwidthEstimation.reset();
    }
  }

  // Subtitle management - Create single native HTML track
  setupSubtitleTracks(subtitleTracks) {
    this.createSingleWorkingTrack();
  }

  createSingleWorkingTrack() {
    if (this.subtitleTrackCreated) {
      return;
    }
    
    try {
      // Remove existing tracks
      const existingTracks = this.video.querySelectorAll('track');
      existingTracks.forEach(track => track.remove());
      
      // Clear existing textTracks
      while (this.video.textTracks.length > 0) {
        try {
          this.video.textTracks[0].mode = 'disabled';
        } catch (e) {
          break;
        }
      }
      
      // Create single subtitle track
      const vttUrl = this.hls.url.replace('/master.m3u8', '/subtitles.vtt');
      const trackElement = document.createElement('track');
      trackElement.kind = 'subtitles';
      trackElement.label = 'Korean';
      trackElement.srclang = 'ko';
      trackElement.src = vttUrl;
      trackElement.default = true;
      
      this.video.appendChild(trackElement);
      this.subtitleTrackCreated = true;
      
    } catch (error) {
      console.error('Error creating subtitle track:', error);
    }
  }



  enableSubtitles(trackIndex = 0) {
    const tracks = this.video.querySelectorAll('track[kind="subtitles"]');
    if (tracks.length > 0 && trackIndex < tracks.length) {
      const textTracks = this.video.textTracks;
      if (textTracks && textTracks[trackIndex]) {
        textTracks[trackIndex].mode = 'showing';
        return true;
      }
    }
    return false;
  }



  disableSubtitles() {
    try {
      const textTracks = this.video.textTracks;
      if (textTracks) {
        for (let i = 0; i < textTracks.length; i++) {
          if (textTracks[i].kind === 'subtitles') {
            textTracks[i].mode = 'disabled';
          }
        }

        return true;
      }
    } catch (error) {
      console.error('Error disabling subtitles:', error);
    }
    return false;
  }

  // ✅ Centralized bandwidth-based subtitle control
  controlSubtitlesByBandwidth() {
    const currentBandwidth = this.getEWMABandwidth(); // Get current EWMA bandwidth in kbps
    if (currentBandwidth < 5000) {
      console.log(`HLS-MANAGER: Enabling subtitles - bandwidth ${currentBandwidth.toFixed(0)} kbps < 5000 kbps`);
      this.enableSubtitles();
    } else {
      console.log(`HLS-MANAGER: Disabling subtitles - bandwidth ${currentBandwidth.toFixed(0)} kbps >= 5000 kbps`);
      this.disableSubtitles();
    }
  }

  destroy() {
    this.resetLoadingBitrate();
    this.clearStream();
  }
}

// Export for global access
window.EWMAHLSManager = EWMAHLSManager;
