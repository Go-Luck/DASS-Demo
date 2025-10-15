import { Events } from '../events';
import EwmaBandWidthEstimator from '../utils/ewma-bandwidth-estimator';
import { PlaylistLevelType } from '../types/loader';
import type Hls from '../hls';
import type { AbrComponentAPI } from '../types/component-api';
import type { FragBufferedData } from '../types/events';
import type { Fragment } from '../loader/fragment';

class AbrController implements AbrComponentAPI {
  private hls: Hls;
  public bwEstimator: EwmaBandWidthEstimator;
  private currentEstimate: number = 0;

  // nextSemanticLevel 활용
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

    // 다음 청크의 SemanticLevel 저장
    this.nextSemanticLevel =
      typeof frag.nextSemanticLevel === 'number'
        ? frag.nextSemanticLevel
        : null;
  }

  get nextAutoLevel(): number {
    const levels = this.hls.levels;
    const bw = this.bwEstimator.canEstimate()
      ? this.currentEstimate
      : this.hls.config.abrEwmaDefaultEstimate;

    const nextSemanticLevel = this.nextSemanticLevel;

    // 룰 넣기
    if (typeof nextSemanticLevel === 'number') {
      if (nextSemanticLevel === 0) {
        return 0;
      }

      const maxLevelIndex = nextSemanticLevel; // 예: 1이면 0~1, 2면 0~2

      for (let i = maxLevelIndex; i >= 0; i--) {
        const bitrate = levels[i].maxBitrate || levels[i].bitrate;
        if (bitrate <= bw) {
          return i;
        }
      }

      return 0; // fallback
    }

    // 기본 ABR 로직 (semanticLevel 정보 없을 경우)
    for (let i = levels.length - 1; i >= 0; i--) {
      const bitrate = levels[i].maxBitrate || levels[i].bitrate;
      if (bitrate <= bw) {
        return i;
      }
    }

    return 0;
  }

  set nextAutoLevel(_: number) {}

  get forcedAutoLevel(): number {
    return -1;
  }

  get firstAutoLevel(): number {
    return 0;
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
