//npm install chrome-remote-interface
//"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --disable-popup-blocking --ignore-certificate-errors --user-data-dir="C:\\tmp\\remote-profile" "http://http://127.0.0.1:5500/hls.js/html/DASS.html"
const CDP = require("chrome-remote-interface");
const fs = require("fs");
const path = require("path");

const TRACE_NAME = "semantic_trace.txt";
const tracePath = path.join(__dirname, "trace", TRACE_NAME);
const DOWNLOAD_WAIT = 5000;

// 트레이스 파싱 함수
function parseTrace(filePath) {
  const lines = fs.readFileSync(filePath, "utf-8").trim().split("\n");
  const trace = lines.map((line) => line.split(" ").map(Number));

  const parsed = [];
  if (trace.length >= 1 && trace[0][0] > 0) {
    const [t1, b1] = trace[0];
    parsed.push({ duration: t1 / 1000, bandwidthKbps: b1 });
  }
  for (let i = 0; i < trace.length - 1; i += 2) {
    const [t1, b1] = trace[i];
    const [t2] = trace[i + 1];
    parsed.push({ duration: (t2 - t1) / 1000, bandwidthKbps: b1 });
  }
  return parsed;
}

// bandwidth 제한 설정
async function setBandwidth(Network, bwKbps) {
  await Network.emulateNetworkConditions({
    offline: false,
    latency: 50,
    downloadThroughput: (bwKbps * 1000) / 8,
    uploadThroughput: 1000000 / 8,
    connectionType: "cellular3g",
  });
}

// index1.html 탭 찾기
async function waitForTarget() {
  let target = null;
  while (!target) {
    try {
      const targets = await CDP.List();
      target = targets.find(
        (t) => t.type === "page" && t.url.includes("EWMA_CleanDASS.html")
      );
      if (!target) console.log("🔁 EWMA_CleanDASS.html 탭을 찾는 중...");
    } catch {
      console.log("CDP 연결 대기 중...");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return target;
}

// 실험 메인 로직
async function runExperiment() {
  console.log("CDP 실험 시작");

  const target = await waitForTarget();
  console.log(`연결된 탭: ${target.title} (${target.url})`);

  const client = await CDP({ target });
  const { Network, Page, Runtime } = client;
  await Network.enable();

  const parsedChunks = parseTrace(tracePath);
  const firstBw = parsedChunks[0].bandwidthKbps;

  // 초기화 및 페이지 로딩
  await setBandwidth(Network, firstBw);
  await Page.navigate({ url: "about:blank" });
  await new Promise((r) => setTimeout(r, 1000));
  await Page.navigate({ url: target.url });
  console.log("index1.html 로딩 중...");
  await new Promise((r) => setTimeout(r, 5000));

  // 트레이스에 따라 bandwidth 변경
  for (const chunk of parsedChunks) {
    await Runtime.evaluate({
      expression: `window.__currentBandwidth__ = ${chunk.bandwidthKbps}`,
    });
    await setBandwidth(Network, chunk.bandwidthKbps);
    console.log(`→ BW: ${chunk.bandwidthKbps} kbps`);
    await new Promise((r) => setTimeout(r, chunk.duration * 1000));
  }

  await new Promise((r) => setTimeout(r, DOWNLOAD_WAIT));

  // 종료
  await client.close();
  console.log("\n실험 완료!");
}

runExperiment();
