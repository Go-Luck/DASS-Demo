import { Events } from '../events';
import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { PlaylistLevelType } from '../types/loader';
import type Hls from '../hls';
import type { AbrComponentAPI } from '../types/component-api';
import type { FragBufferedData, ManifestParsedData } from '../types/events';
import type { Level } from '../types/level';

class AbrController implements AbrComponentAPI {
  private hls: Hls;
  public bwEstimator: EwmaBandWidthEstimator;
  private currentEstimate: number = 0;
  private nextSemanticLevel: number | null = null;

  constructor(hls: Hls) {
    this.hls = hls;
    this.bwEstimator = new EwmaBandWidthEstimator(
      hls.config.abrEwmaSlowVoD,
      hls.config.abrEwmaFastVoD,
      hls.config.abrEwmaDefaultEstimate,
    );
    this.registerListeners();
  }

  private registerListeners() {
    this.hls.once(Events.MANIFEST_PARSED, this.onManifestParsed, this);
    this.hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }
  private onManifestParsed(
    event: Events.MANIFEST_PARSED,
    data: ManifestParsedData,
  ) {
    const levels = this.hls.levels;
    const firstPrivacyIndex = levels.findIndex((level) =>
      level.name?.includes('_privacy'),
    );
    if (firstPrivacyIndex !== -1) {
      this.hls.startLevel = firstPrivacyIndex;
    }
  }

  private onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    const { frag, stats } = data;
    if (frag.type !== PlaylistLevelType.MAIN || stats.aborted) return;
    const ttfb = stats.loading.first - stats.loading.start;
    const downloadTime =
      stats.parsing.end -
      stats.loading.start -
      Math.min(ttfb, this.bwEstimator.getEstimateTTFB());
    this.bwEstimator.sample(downloadTime, stats.loaded);
    this.currentEstimate = this.bwEstimator.getEstimate();
    this.nextSemanticLevel =
      typeof frag.nextSemanticLevel === 'number'
        ? frag.nextSemanticLevel
        : null;
  }

  get nextAutoLevel(): number {
    const allLevels = this.hls.levels;
    if (!allLevels || allLevels.length === 0) return -1;
    const bw = this.bwEstimator.canEstimate()
      ? this.currentEstimate
      : this.hls.config.abrEwmaDefaultEstimate;
    const nextSemanticLevel = this.nextSemanticLevel;

    // Risk Level에 따라 privacy/clear 스트림 그룹을 선택
    let wantPrivacy: boolean;
    if (typeof nextSemanticLevel === 'number' && nextSemanticLevel < 2) {
      wantPrivacy = true; // Risk 0, 1 -> privacy
    } else {
      wantPrivacy = false; // Risk 2 또는 정보 없음 -> clear
    }

    const candidateIndices: number[] = [];
    allLevels.forEach((level, index) => {
      const isPrivacyLevel = level.name?.includes('_privacy');
      if (
        (wantPrivacy && isPrivacyLevel) ||
        (!wantPrivacy && !isPrivacyLevel)
      ) {
        candidateIndices.push(index);
      }
    });

    const indicesToSearch =
      candidateIndices.length > 0
        ? candidateIndices
        : allLevels.map((_, index) => index);
    if (indicesToSearch.length === 0) return 0;

    let bestLevelIdx = -1;
    let searchStartIdx = indicesToSearch.length - 1;
    if (typeof nextSemanticLevel === 'number') {
      const riskCapIndexInCandidates = nextSemanticLevel;
      searchStartIdx = Math.min(searchStartIdx, riskCapIndexInCandidates);
    }
    for (let i = searchStartIdx; i >= 0; i--) {
      const currentLevelIndex = indicesToSearch[i];
      const level = allLevels[currentLevelIndex];
      const bitrate = level.maxBitrate || level.bitrate;
      if (bitrate <= bw) {
        bestLevelIdx = currentLevelIndex;
        break;
      }
    }
    if (bestLevelIdx === -1) {
      bestLevelIdx = indicesToSearch[0];
    }
    return bestLevelIdx;
  }

  set nextAutoLevel(_: number) {}
  get forcedAutoLevel(): number {
    return -1;
  }
  get firstAutoLevel(): number {
    return -1;
  }

  destroy() {
    this.hls.off(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  resetEstimator() {
    this.bwEstimator = new EwmaBandWidthEstimator(
      this.hls.config.abrEwmaSlowVoD,
      this.hls.config.abrEwmaFastVoD,
      this.hls.config.abrEwmaDefaultEstimate,
    );
  }
}

export default AbrController;
