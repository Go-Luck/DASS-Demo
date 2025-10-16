import { Events } from '../events';
import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { PlaylistLevelType } from '../types/loader';
import type Hls from '../hls';
import type { AbrComponentAPI } from '../types/component-api';
import type { FragBufferedData } from '../types/events';
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
    this.hls.on(Events.FRAG_BUFFERED, this.onFragBuffered, this);
  }

  private onFragBuffered(event: Events.FRAG_BUFFERED, data: FragBufferedData) {
    const { frag, stats } = data;
    if (frag.type !== PlaylistLevelType.MAIN || stats.aborted) {
      return;
    }
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
    const bw = this.bwEstimator.canEstimate()
      ? this.currentEstimate
      : this.hls.config.abrEwmaDefaultEstimate;
    const nextSemanticLevel = this.nextSemanticLevel;

    // 전체 레벨 목록에서 이름에 '_privacy'가 포함되지 않은(clear) 것들만 선택
    const clearLevelIndices: number[] = [];
    allLevels.forEach((level, index) => {
      if (!level.name?.includes('_privacy')) {
        clearLevelIndices.push(index);
      }
    });

    const indicesToSearch =
      clearLevelIndices.length > 0
        ? clearLevelIndices
        : allLevels.map((_, index) => index);

    if (indicesToSearch.length === 0) {
      return 0;
    }

    // 필터링된 'clear' 목록에 대해 리스크 인지 ABR 로직을 적용
    if (typeof nextSemanticLevel === 'number') {
      const maxLevelIndex = nextSemanticLevel;

      for (let i = indicesToSearch.length - 1; i >= 0; i--) {
        const levelIndex = indicesToSearch[i];
        const level = allLevels[levelIndex];

        if (levelIndex <= maxLevelIndex) {
          const bitrate = level.maxBitrate || level.bitrate;
          if (bitrate <= bw) {
            return levelIndex;
          }
        }
      }
      // 조건을 만족하는 레벨이 없으면, clear 후보군 중 가장 낮은 화질로 fallback
      return indicesToSearch[0];
    }

    // 리스크 정보가 없을 경우, 필터링된 clear 목록에 대해 기본 ABR 로직 수행
    for (let i = indicesToSearch.length - 1; i >= 0; i--) {
      const levelIndex = indicesToSearch[i];
      const level = allLevels[levelIndex];
      const bitrate = level.maxBitrate || level.bitrate;
      if (bitrate <= bw) {
        return levelIndex;
      }
    }
    return indicesToSearch[0];
  }

  set nextAutoLevel(_: number) {}
  get forcedAutoLevel(): number {
    return -1;
  }

  get firstAutoLevel(): number {
    if (!this.hls.levels || this.hls.levels.length === 0) {
      return 0;
    }
    const firstClearIndex = this.hls.levels.findIndex(
      (level) => !level.name?.includes('_privacy'),
    );
    return firstClearIndex !== -1 ? firstClearIndex : 0;
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
