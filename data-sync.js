/**
 * 健康数据同步模块
 *
 * 从后端 /api/health 拉取小米运动健康真实数据，
 * 并更新前端显示。数据不可用时回退到演示数据。
 */

const HealthData = {
  loaded: false,
  connected: false,
  data: null,
  fetchTime: null,
};

// 回退用的演示数据（与原有 app.js 保持一致）
const FALLBACK_DATA = {
  sleep: {
    available: true,
    latest: {
      date: "2026-11-01",
      totalMinutes: 402,
      totalHours: 6,
      totalMinutesRemainder: 42,
      lightMinutes: 210,
      deepMinutes: 72,
      remMinutes: 90,
      wakeCount: 2,
      bedtime: "23:12",
      wakeTime: "06:10",
      score: 72,
    },
    nights: [],
  },
  heartRate: {
    available: true,
    restingHr: 62,
    latest: {
      date: "2026-11-01",
      restingHr: 62,
      avgHr: 68,
      maxHr: 95,
      minHr: 52,
      samples: [],
    },
    days: [],
  },
  activity: {
    available: true,
    todaySteps: 7320,
    latest: {
      date: "2026-11-01",
      steps: 7320,
      distance: 5200,
      calories: 210,
      exerciseTime: 35,
    },
    days: [],
  },
  weight: {
    available: false,
    records: [],
  },
  fetchTime: null,
};

/**
 * 从后端获取全部健康数据
 */
async function fetchHealthData() {
  try {
    const res = await fetch("/api/health");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    if (json.ok) {
      HealthData.data = json.data;
      HealthData.connected = true;
      HealthData.fetchTime = json.data.fetchTime;
      return json.data;
    }
    throw new Error(json.error || "数据获取失败");
  } catch (err) {
    console.warn("[健康数据] 后端不可用，使用演示数据:", err.message);
    HealthData.connected = false;
    HealthData.data = FALLBACK_DATA;
    HealthData.fetchTime = null;
    return FALLBACK_DATA;
  }
}

/**
 * 将分钟转为"X时Y分"格式
 */
function formatSleepDuration(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return { hours: h, minutes: m };
}

/**
 * 更新首页指标
 */
function updateHomeMetrics(data) {
  // 日期
  const dateLine = document.querySelector(".date-line");
  if (dateLine) {
    const now = new Date();
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const month = now.getMonth() + 1;
    const day = now.getDate();
    dateLine.textContent = `${month}月${day}日 · ${weekdays[now.getDay()]}`;
  }

  // 睡眠
  const sleepCloud = document.querySelector(".sleep-cloud strong");
  if (sleepCloud && data.sleep?.latest) {
    const dur = formatSleepDuration(data.sleep.latest.totalMinutes);
    sleepCloud.innerHTML = `${dur.hours}<em>时</em>${dur.minutes}<em>分</em>`;
  }

  // 心率
  const heartCloud = document.querySelector(".heart-cloud strong");
  if (heartCloud && data.heartRate?.restingHr) {
    heartCloud.innerHTML = `${data.heartRate.restingHr}<em>bpm</em>`;
  }

  // 同步状态
  const syncPill = document.querySelector(".sync-pill");
  if (syncPill) {
    const dot = syncPill.querySelector(".sync-dot");
    if (HealthData.connected) {
      syncPill.lastChild.textContent = " 小米已同步";
      if (dot) dot.style.background = "#9ec5a8";
    } else {
      syncPill.lastChild.textContent = " 演示数据";
      if (dot) dot.style.background = "#e0c97a";
    }
  }

  // 今日云层描述
  const stateKicker = document.querySelector(".state-kicker");
  const todayTitle = document.querySelector(".today-note h2");
  const todayDesc = document.querySelector(".today-note > p:last-child");
  if (stateKicker && todayTitle && data.sleep?.latest) {
    const wakeCount = data.sleep.latest.wakeCount || 0;
    const sleepDur = formatSleepDuration(data.sleep.latest.totalMinutes);
    if (wakeCount > 1) {
      stateKicker.textContent = "今日云层 · 有一小片困意";
      todayTitle.innerHTML = "多醒了 " + wakeCount + " 次<br />云层有点沉";
      if (todayDesc) todayDesc.textContent = `睡了 ${sleepDur.hours} 时 ${sleepDur.minutes} 分，今天可以放慢节奏。`;
    } else {
      stateKicker.textContent = "今日云层 · 轻轻的";
      todayTitle.innerHTML = "云层平稳<br />轻轻飘着";
      if (todayDesc) todayDesc.textContent = `睡了 ${sleepDur.hours} 时 ${sleepDur.minutes} 分，状态还不错。`;
    }
  }

  // 心率过高/过低提示
  if (data.heartRate?.restingHr && stateKicker) {
    const hr = data.heartRate.restingHr;
    if (hr > 100) {
      stateKicker.textContent = "今日云层 · 心跳偏快";
    } else if (hr < 50) {
      stateKicker.textContent = "今日云层 · 心跳偏慢";
    }
  }
}

/**
 * 更新详情面板数据（供 app.js 的 details 对象使用）
 */
function getDynamicDetails(data) {
  const sleepLatest = data.sleep?.latest;
  const heartLatest = data.heartRate?.latest;
  const activityLatest = data.activity?.latest;

  const sleepDetail = sleepLatest
    ? {
        eyebrow: `昨夜云层 · ${sleepLatest.date || "今天"}`,
        title: `睡了 ${Math.floor(sleepLatest.totalMinutes / 60)} 小时 ${sleepLatest.totalMinutes % 60} 分`,
        icon: "i-moon",
        summary:
          (sleepLatest.wakeCount > 0
            ? `夜里醒了 ${sleepLatest.wakeCount} 次。`
            : "整夜连续睡眠。") +
          `入睡 ${sleepLatest.bedtime || "—"}，起床 ${sleepLatest.wakeTime || "—"}`,
        insight: sleepLatest.score && sleepLatest.score < 70
          ? "睡眠分数偏低，今天可以少安排一些高强度任务，午后适当休息。"
          : "睡眠在正常范围，保持今天的节奏就好。",
        chart: function () {
          return generateSleepPath(data.sleep);
        },
        labels: ["入睡", "0时", "2时", "4时", "6时", "起床"],
        footnote: `睡眠数据来自小米运动健康${HealthData.connected ? "，最近同步于 " + formatSyncTime() : "（演示数据）"}。单次睡眠波动不能用于诊断。`,
      }
    : null;

  const heartDetail = heartLatest
    ? {
        eyebrow: `安静心跳 · ${heartLatest.date || "近24小时"}`,
        title: `静息心率 ${heartLatest.restingHr || data.heartRate.restingHr} bpm`,
        icon: "i-heart",
        summary: `最高 ${heartLatest.maxHr || "—"} bpm，最低 ${heartLatest.minHr || "—"} bpm，平均 ${heartLatest.avgHr || "—"} bpm`,
        insight: generateHeartInsight(heartLatest, data.sleep?.latest),
        chart: function () {
          return generateHeartPath(data.heartRate);
        },
        labels: ["0时", "4时", "8时", "12时", "16时", "20时"],
        footnote: `心率数据佩戴存在误差${HealthData.connected ? "，来自小米运动健康" : "（演示数据）"}。如果伴随胸痛、呼吸困难或晕厥，请立即联系急救。`,
      }
    : null;

  return { sleep: sleepDetail, heart: heartDetail, activity: activityLatest };
}

function generateHeartInsight(heart, sleep) {
  const restingHr = heart.restingHr || 62;
  if (restingHr > 85) {
    return "今天静息心率偏高，可能与睡眠不足、压力或咖啡因有关。先补水、走动几分钟，观察下午是否回落。";
  }
  if (restingHr < 55) {
    return "静息心率偏低，如果你长期运动这是正常表现。如果伴随头晕或乏力，请注意观察并考虑咨询医生。";
  }
  if (sleep && sleep.wakeCount > 1) {
    return "昨晚少睡和多醒可能让心率暂时升高几拍。先补水，走动 3 分钟，再看下午趋势。";
  }
  return "心率在正常范围内，保持今天的节奏和水分补充就好。";
}

function formatSyncTime() {
  if (!HealthData.fetchTime) return "刚刚";
  try {
    const d = new Date(HealthData.fetchTime);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "刚刚";
  }
}

// 根据历史数据生成 SVG 路径
function generateSleepPath(sleepData) {
  if (!sleepData?.nights || sleepData.nights.length < 2) {
    return "M2 67C36 61 51 30 79 39S113 74 142 55s39-24 69-13 54 17 82 0";
  }
  const nights = sleepData.nights.slice(-7).reverse();
  const maxDur = Math.max(...nights.map((n) => n.totalMinutes || 400), 480);
  const minDur = Math.min(...nights.map((n) => n.totalMinutes || 400), 300);
  const range = maxDur - minDur || 100;
  const points = nights.map((n, i) => {
    const x = 2 + (i / (nights.length - 1)) * 296;
    const normalized = (n.totalMinutes - minDur) / range;
    const y = 100 - normalized * 80 - 10;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (points.length < 2) return "M2 67C36 61 51 30 79 39S113 74 142 55s39-24 69-13 54 17 82 0";
  return `M${points.join(" L")}`;
}

function generateHeartPath(heartData) {
  if (!heartData?.latest?.samples || heartData.latest.samples.length < 2) {
    return "M2 60C27 63 42 48 68 52s31 25 55 18 30-34 56-27 33 28 59 20 35-17 55-12";
  }
  const samples = heartData.latest.samples.slice(0, 24);
  const hrs = samples.map((s) => s.hr || 65);
  const maxHr = Math.max(...hrs, 90);
  const minHr = Math.min(...hrs, 50);
  const range = maxHr - minHr || 30;
  const points = samples.map((s, i) => {
    const x = 2 + (i / Math.max(samples.length - 1, 1)) * 296;
    const normalized = (s.hr - minHr) / range;
    const y = 100 - normalized * 80 - 10;
    return `${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  if (points.length < 2) return "M2 60C27 63 42 48 68 52s31 25 55 18 30-34 56-27 33 28 59 20 35-17 55-12";
  return `M${points.join(" L")}`;
}

/**
 * 更新同步状态面板内容
 */
function getSyncStatusRows(data) {
  const rows = [];
  const syncTime = formatSyncTime();

  rows.push({
    label: "睡眠与清醒次数",
    status: data.sleep?.available ? "已更新" : "未同步",
  });
  rows.push({
    label: "静息心率",
    status: data.heartRate?.available ? "已更新" : "未同步",
  });
  rows.push({
    label: "步数与运动",
    status: data.activity?.available ? "已更新" : "未同步",
  });
  rows.push({
    label: "体重 / 体成分",
    status: data.weight?.available ? "已更新" : "未开放",
  });

  return { rows, syncTime };
}

/**
 * 更新基线数据（从30天历史计算）
 */
function getBaselineData(data) {
  const baseline = {
    sleep: { range: null, latest: null, unit: "时" },
    wakeCount: { range: null, latest: null, unit: "次" },
    heartRate: { range: null, latest: null, unit: "bpm" },
    days: 0,
    validDays: 0,
  };

  // 睡眠基线
  if (data.sleep?.nights?.length > 0) {
    const nights = data.sleep.nights.filter((n) => n.totalMinutes > 0);
    const durations = nights.map((n) => n.totalMinutes / 60);
    const sorted = [...durations].sort((a, b) => a - b);
    const p10 = sorted[Math.floor(sorted.length * 0.1)] || sorted[0];
    const p90 = sorted[Math.floor(sorted.length * 0.9)] || sorted[sorted.length - 1];
    baseline.sleep.range = [p10, p90];
    baseline.sleep.latest = data.sleep.latest?.totalMinutes / 60 || null;
    baseline.days = nights.length;

    const wakeCounts = nights.map((n) => n.wakeCount || 0).sort((a, b) => a - b);
    baseline.wakeCount.range = [
      wakeCounts[0] || 0,
      wakeCounts[Math.floor(wakeCounts.length * 0.75)] || 1,
    ];
    baseline.wakeCount.latest = data.sleep.latest?.wakeCount || 0;
  }

  // 心率基线
  if (data.heartRate?.days?.length > 0) {
    const days = data.heartRate.days.filter((d) => d.restingHr);
    const hrs = days.map((d) => d.restingHr).sort((a, b) => a - b);
    baseline.heartRate.range = [
      hrs[Math.floor(hrs.length * 0.1)] || hrs[0],
      hrs[Math.floor(hrs.length * 0.9)] || hrs[hrs.length - 1],
    ];
    baseline.heartRate.latest = data.heartRate.restingHr;
    baseline.validDays = days.length;
  }

  return baseline;
}

/**
 * 初始化：获取数据并更新 UI
 */
async function initHealthData() {
  HealthData.loaded = true;
  const data = await fetchHealthData();
  updateHomeMetrics(data);

  // 将动态详情注入全局，供 app.js 使用
  window.__healthDetails = getDynamicDetails(data);
  window.__healthData = data;
  window.__healthConnected = HealthData.connected;
  window.__syncStatus = getSyncStatusRows(data);
  window.__baseline = getBaselineData(data);

  // 触发自定义事件通知 app.js 数据已就绪
  window.dispatchEvent(new CustomEvent("health-data-ready"));
}

// 页面加载后自动获取
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHealthData);
} else {
  initHealthData();
}

// 暴露给全局
window.HealthData = HealthData;
window.refreshHealthData = initHealthData;
