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

    // 1. Risk Level에 따라 'privacy' 또는 'clear' 스트림 그룹을 선택 (기존과 동일)
    let wantPrivacy: boolean;
    if (typeof nextSemanticLevel === 'number' && nextSemanticLevel < 2) {
      wantPrivacy = true;
    } else {
      wantPrivacy = false;
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

    // [수정] Risk Level을 품질 상한선으로 사용하는 로직을 제거했습니다.
    // 이제 searchStartIdx는 항상 선택된 그룹의 가장 높은 화질 인덱스가 됩니다.
    let bestLevelIdx = -1;
    const searchStartIdx = indicesToSearch.length - 1;

    // 2. 선택된 그룹 내에서, 네트워크가 허용하는 가장 높은 화질을 선택
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
