/**
 * Chart Manager - Chart.js를 사용한 실시간 차트 관리
 */
class ChartManager {
  constructor() {
    this.metricsChart = null;
    this.metricsManager = null;
    this.chartLegend = document.getElementById('chartLegend');
    this.chartLabels = document.getElementById('chartLabels');
    this.checkboxListenersSetup = false; // 중복 설정 방지
  }

  setMetricsManager(metricsManager) {
    this.metricsManager = metricsManager;
  }

  initChart() {
    // 기존 차트가 있다면 완전히 파괴
    if (this.metricsChart) {
      this.metricsChart.destroy();
      this.metricsChart = null;
    }
    
    const ctx = document.getElementById('metricsChart').getContext('2d');

    this.metricsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: []
      },
      
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: {
          padding: 0
        },
        interaction: {
          mode: 'index',
          intersect: false,
        },
        scales: {
          x: {
            type: 'category',
            display: true,
            grid: {
              display: true, // X축 그리드 라인 표시
              color: '#e9ecef',
              lineWidth: 1,
              drawBorder: false // X축 경계선 제거
            },
            ticks: {
              color: '#6c757d',
              font: {
                size: 11
              },
              maxTicksLimit: 10
            },
            border: {
              display: false // X축 테두리 제거
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(0,0,0,0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: '#dee2e6',
            borderWidth: 1
          }
        },
        elements: {
          line: {
            borderWidth: 2
          }
        }
      }
    });
  }

  setupCheckboxListeners() {
    // 이미 설정되었다면 중복 설정 방지
    if (this.checkboxListenersSetup) {
      return;
    }
    
    // 직접 모든 체크박스를 찾아서 이벤트 리스너 추가
    const allCheckboxes = document.querySelectorAll('input[type="checkbox"]');
    
    if (allCheckboxes.length === 0) {
      setTimeout(() => {
        this.setupCheckboxListeners();
      }, 300);
      return;
    }
    
    // 각 체크박스에 개별적으로 이벤트 리스너 바인딩
    allCheckboxes.forEach((checkbox) => {
      // 기존 리스너 제거 (중복 방지)
      const existingHandler = checkbox.getAttribute('data-handler-attached');
      if (existingHandler !== 'true') {
        // 새 리스너 추가
        const boundHandler = this.handleCheckboxChangeDirectly.bind(this);
        checkbox.addEventListener('change', boundHandler);
        checkbox.setAttribute('data-handler-attached', 'true');
      }
    });
    
    this.checkboxListenersSetup = true;
  }

  handleCheckboxChangeDirectly(event) {
    const checkbox = event.target;
    
    if (checkbox.checked) {
      // Get total checkboxes for this system
      const allCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
      const checkedCount = allCheckboxes.length;
      
      // Different limits for different systems
      let maxAllowed = 3; // Default for DNN system
      
      // For EWMA system (has only 2 checkboxes total)
      const totalCheckboxes = document.querySelectorAll('input[type="checkbox"]');
      if (totalCheckboxes.length <= 2) {
        maxAllowed = 2; // EWMA system
      }
      
      // Check limit
      if (checkedCount > maxAllowed) {
        alert(`최대 ${maxAllowed}개까지만 선택 가능합니다`);
        checkbox.checked = false;
        return;
      }
    }
    
    // 차트 업데이트 (메트릭 매니저가 있는 경우에만)
    if (this.metricsManager) {
      this.updateChart();
    }
  }

  getCheckedBoxes() {
    if (!this.metricsManager) return [];
    
    const metricsConfig = this.metricsManager.getMetricsConfig();
    const checkedBoxes = [];
    
    Object.keys(metricsConfig).forEach(key => {
      const checkbox = document.getElementById(key + 'Check');
      if (checkbox && checkbox.checked) {
        checkedBoxes.push(checkbox);
      }
    });
    
    return checkedBoxes;
  }

  updateChart() {
    if (!this.metricsChart || !this.metricsManager) return;

    const { metrics: activeMetrics, configs: activeConfigs } = this.metricsManager.getActiveMetrics();
    
    // ✅ NEW: Calculate the maximum value across all active metrics to create unified scale
    let globalMax = 0;
    activeConfigs.forEach(({ key, config }) => {
      const data = this.metricsManager.getMetricsData()[key] || [];
      const maxValue = Math.max(...data, 0);
      globalMax = Math.max(globalMax, maxValue);
    });

    // ✅ NEW: Force globalMax to be a multiple of 1000 for cleaner scales
    if (globalMax === 0) {
      globalMax = 1000; // Default minimum scale
    } else {
      // Round up to the next multiple of 1000
      globalMax = Math.ceil(globalMax / 1000) * 1000;
    }
    
    
    // ✅ NEW: Generate exact same tick values for all Y-axes to ensure perfect alignment
    const tickCount = 5; // Number of ticks
    const stepSize = globalMax / (tickCount - 1);
    const commonTicks = [];
    for (let i = 0; i < tickCount; i++) {
      commonTicks.push(Math.round(i * stepSize));
    }
    
    
    // ✅ NEW: Create a base Y-axis configuration that all axes will share
    const baseYAxisConfig = {
      type: 'linear',
      display: true,
      position: 'right',
      grid: {
        drawOnChartArea: false,
        display: false
      },
      border: {
        display: true,
        lineWidth: 1
      },
      // ✅ Force exact same scale bounds - this is critical
      min: 0,
      max: globalMax,
      beginAtZero: true,
      grace: 0, // No padding
      ticks: {
        display: true,
        font: {
          size: 10,
          weight: 'bold'
        },
        padding: 5,
        // ✅ Force Chart.js to use exact tick count and values
        maxTicksLimit: tickCount,
        stepSize: stepSize,
        precision: 0,
        // Override Chart.js automatic tick generation
        callback: function(value, index, ticks) {
          const roundedValue = Math.round(value);
          // Only show our predefined common ticks
          if (commonTicks.includes(roundedValue)) {
            return roundedValue.toString();
          }
          return null; // Hide other ticks
        }
      }
    };
    
    // 완전히 새로운 스케일 객체 생성 (기존 Y축들 제거)
    const activeScales = {
      x: {
        type: 'category',
        display: true,
        grid: {
          display: true, // X축 그리드 라인 표시
          color: '#e9ecef',
          lineWidth: 1,
          drawBorder: true
        },
        ticks: {
          color: '#6c757d',
          font: {
            size: 11
          },
          maxTicksLimit: 10
        },
        border: {
          display: true
        }
      }
    };

    // Clear previous content
    this.chartLegend.innerHTML = '';
    
    // 범례 컨테이너에 강제 스타일 적용
    this.chartLegend.style.cssText = 'display: flex !important; flex-direction: row !important; align-items: center !important; gap: 20px !important; flex-wrap: wrap !important; justify-content: flex-start !important;';

    activeConfigs.forEach(({ key, config }, index) => {
      // ✅ CRITICAL CHANGE: Use the same yAxisID for both metrics to force identical positioning
      const yAxisID = 'sharedY'; // Force all metrics to use the same Y-axis
      
      // Only create the Y-axis once (for the first metric)
      if (index === 0) {
        activeScales[yAxisID] = {
          ...baseYAxisConfig, // Use shared base configuration
          title: {
            display: true, // ✅ Enable title to show "[kbps]" label
            text: '[kbps]', // ✅ Add kbps unit label
            color: '#333',
            font: {
              size: 20,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 5
            }
          },
          ticks: {
            ...baseYAxisConfig.ticks,
            color: '#333' // Use neutral color for shared axis
          },
          border: {
            ...baseYAxisConfig.border,
            color: '#333' // Use neutral color for shared axis border
          }
        };
      }

      // 범례 추가 (DASH 스타일)
      this.addLegendItem(config);
    });

    // 차트 데이터 업데이트
    const timeLabels = this.metricsManager.getTimeLabels();
    this.metricsChart.data.labels = [...timeLabels];
    this.metricsChart.data.datasets = activeMetrics;
    this.metricsChart.options.scales = activeScales;

    // 강제로 차트 다시 그리기
    this.metricsChart.update('resize');
  }

  addLegendItem(config) {
    const legendItem = document.createElement('div');
    legendItem.style.cssText = 'display: inline-flex !important; align-items: center !important; gap: 8px !important; margin-right: 20px !important; white-space: nowrap !important; vertical-align: top !important; border: none !important;';
    legendItem.innerHTML = `
      <div style="width: 12px; height: 12px; background-color: ${config.color}; border: 1px solid ${config.color}; border-radius: 2px; flex-shrink: 0; display: inline-block; vertical-align: middle;"></div>
      <span style="display: inline-block; vertical-align: middle; font-size: 13px; color: #333; font-weight: 500; border: none !important;">${config.label}</span>
    `;
    this.chartLegend.appendChild(legendItem);
  }


  clearCharts() {
    if (!this.metricsManager) return;

    // 차트 데이터 완전 초기화
    if (this.metricsChart) {
      this.metricsChart.data.labels = [];
      this.metricsChart.data.datasets = [];
      this.metricsChart.update();
    }

    this.metricsManager.clearData();
    if (this.metricsChart) {
      this.updateChart();
    }
  }

  disableCharts() {
    if (!this.metricsManager) return;

    // 모든 체크박스 해제
    const metricsConfig = this.metricsManager.getMetricsConfig();
    Object.keys(metricsConfig).forEach(key => {
      const checkbox = document.getElementById(key + 'Check');
      if (checkbox) {
        checkbox.checked = false;
      }
    });
    this.updateChart();
  }

  destroy() {
    if (this.metricsChart) {
      this.metricsChart.destroy();
      this.metricsChart = null;
    }
  }
}
