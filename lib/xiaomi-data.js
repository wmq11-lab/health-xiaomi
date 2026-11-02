/**
 * 小米运动健康数据获取模块
 *
 * 通过华米云 API 拉取睡眠、心率、步数等健康数据。
 * 所有请求需要携带 appToken 认证信息。
 */

const fetch = require("node-fetch");

const API_BASE = "https://api-mifit.huami.com";
const UA =
  "MiFit/1.0 (com.huami.watch.hmwatchmanager; build:1; iOS 16.0.0)";

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function formatDateTime(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function buildHeaders(auth) {
  return {
    "User-Agent": UA,
    "x-apptoken": auth.appToken,
    "Content-Type": "application/x-www-form-urlencoded",
  };
}

function buildQuery(auth, extra = {}) {
  return new URLSearchParams({
    userid: auth.userId,
    deviceid: auth.deviceId,
    ...Object.entries(extra).reduce((acc, [k, v]) => {
      acc[k] = String(v);
      return acc;
    }, {}),
  });
}

/**
 * 获取睡眠数据
 * 返回最近一夜及历史趋势
 */
async function getSleep(auth, days = 30) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  const params = buildQuery(auth, {
    start_day: formatDate(startDate),
    end_day: formatDate(today),
    template_id: "sleep_w168",
    template_version: "5",
  });

  const res = await fetch(
    `${API_BASE}/v1/data/sleep.json?${params.toString()}`,
    {
      headers: buildHeaders(auth),
    }
  );

  const data = await res.json();
  return parseSleepData(data);
}

function parseSleepData(rawData) {
  if (!rawData || rawData.error_code) {
    return {
      available: false,
      error: rawData?.error_msg || "无法获取睡眠数据",
      nights: [],
    };
  }

  const sleepList = rawData.data || rawData.sleep_list || [];
  const nights = sleepList.map((item) => {
    const dateStr = item.date || item.day;
    // 睡眠总时长（分钟）
    const totalMin =
      item.total_sleep_duration ||
      item.total_duration ||
      item.sleepDuration ||
      0;
    // 浅睡、深睡
    const lightMin = item.light_sleep_duration || item.light || 0;
    const deepMin = item.deep_sleep_duration || item.deep || 0;
    const remMin = item.rem_sleep_duration || item.rem || 0;
    // 醒来次数
    const wakeCount = item.wake_count || item.awake_count || 0;
    // 入睡时间、起床时间
    const bedtime = item.bedtime || item.start;
    const wakeTime = item.wakeup_time || item.end;

    return {
      date: dateStr,
      totalMinutes: totalMin,
      totalHours: Math.floor(totalMin / 60),
      totalMinutesRemainder: totalMin % 60,
      lightMinutes: lightMin,
      deepMinutes: deepMin,
      remMinutes: remMin,
      wakeCount,
      bedtime,
      wakeTime,
      score: item.score || item.sleep_score,
    };
  });

  return {
    available: nights.length > 0,
    nights: nights.reverse(), // 最近的在前
    latest: nights[0] || null,
  };
}

/**
 * 获取心率数据
 * 返回最近24小时心率趋势及历史
 */
async function getHeartRate(auth, days = 30) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  const params = buildQuery(auth, {
    start_day: formatDate(startDate),
    end_day: formatDate(today),
    template_id: "heart_rate",
    template_version: "1",
  });

  const res = await fetch(
    `${API_BASE}/v1/data/heart_rate.json?${params.toString()}`,
    {
      headers: buildHeaders(auth),
    }
  );

  const data = await res.json();
  return parseHeartRateData(data);
}

function parseHeartRateData(rawData) {
  if (!rawData || rawData.error_code) {
    return {
      available: false,
      error: rawData?.error_msg || "无法获取心率数据",
      days: [],
      restingHr: null,
    };
  }

  const heartList = rawData.data || rawData.heart_rate_list || [];
  const days = heartList.map((item) => {
    const dateStr = item.date || item.day;
    const resting = item.resting_heart_rate || item.resting_hr || item.min_hr;
    const avg = item.avg_heart_rate || item.avg_hr;
    const max = item.max_heart_rate || item.max_hr;
    const min = item.min_heart_rate || item.min_hr;

    // 详细心率点（24小时）
    const samples = item.samples || item.heart_rate_samples || [];

    return {
      date: dateStr,
      restingHr: resting,
      avgHr: avg,
      maxHr: max,
      minHr: min,
      samples: samples.map((s) => ({
        time: s.time || s.timestamp,
        hr: s.value || s.heart_rate,
      })),
    };
  });

  return {
    available: days.length > 0,
    days: days.reverse(),
    latest: days[0] || null,
    restingHr: days[0]?.restingHr || null,
  };
}

/**
 * 获取步数 / 运动数据
 */
async function getActivity(auth, days = 30) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  const params = buildQuery(auth, {
    start_day: formatDate(startDate),
    end_day: formatDate(today),
    template_id: "activity",
    template_version: "1",
  });

  const res = await fetch(
    `${API_BASE}/v1/data/band_activity.json?${params.toString()}`,
    {
      headers: buildHeaders(auth),
    }
  );

  const data = await res.json();
  return parseActivityData(data);
}

function parseActivityData(rawData) {
  if (!rawData || rawData.error_code) {
    return {
      available: false,
      error: rawData?.error_msg || "无法获取运动数据",
      days: [],
    };
  }

  const activityList = rawData.data || rawData.activity_list || [];
  const days = activityList.map((item) => {
    return {
      date: item.date || item.day,
      steps: item.steps || item.step_count,
      distance: item.distance, // 米
      calories: item.calories || item.calory, // 千卡
      exerciseTime: item.exercise_time, // 分钟
    };
  });

  return {
    available: days.length > 0,
    days: days.reverse(),
    latest: days[0] || null,
    todaySteps: days[0]?.steps || null,
  };
}

/**
 * 获取体重 / 体成分数据
 */
async function getWeight(auth, days = 30) {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);

  const params = buildQuery(auth, {
    start_day: formatDate(startDate),
    end_day: formatDate(today),
    template_id: "weight",
    template_version: "1",
  });

  const res = await fetch(
    `${API_BASE}/v1/data/weight.json?${params.toString()}`,
    {
      headers: buildHeaders(auth),
    }
  );

  const data = await res.json();
  return parseWeightData(data);
}

function parseWeightData(rawData) {
  if (!rawData || rawData.error_code) {
    return {
      available: false,
      error: rawData?.error_msg || "无法获取体重数据",
      records: [],
    };
  }

  const weightList = rawData.data || rawData.weight_list || [];
  const records = weightList.map((item) => ({
    date: item.date || item.day,
    weight: item.weight, // kg
    bmi: item.bmi,
    bodyFat: item.body_fat_rate || item.fat_rate, // %
    muscle: item.muscle_mass || item.muscle, // kg
    boneMass: item.bone_mass, // kg
    water: item.water_rate || item.water, // %
  }));

  return {
    available: records.length > 0,
    records: records.reverse(),
    latest: records[0] || null,
  };
}

/**
 * 获取 PAI 指数（个人活动智能）
 */
async function getPai(auth) {
  const today = new Date();
  const params = buildQuery(auth, {
    date: formatDate(today),
    template_id: "pai",
    template_version: "1",
  });

  const res = await fetch(`${API_BASE}/v1/data/pai.json?${params.toString()}`, {
    headers: buildHeaders(auth),
  });

  const data = await res.json();

  if (!data || data.error_code) {
    return { available: false };
  }

  return {
    available: true,
    todayPai: data.data?.total_pai || data.data?.pai,
    weeklyPai: data.data?.week_pai,
  };
}

/**
 * 获取全部健康数据（聚合查询）
 */
async function getAllHealthData(auth) {
  const [sleep, heartRate, activity, weight] = await Promise.allSettled([
    getSleep(auth),
    getHeartRate(auth),
    getActivity(auth),
    getWeight(auth),
  ]);

  return {
    sleep: sleep.status === "fulfilled" ? sleep.value : { available: false, error: sleep.reason?.message },
    heartRate: heartRate.status === "fulfilled" ? heartRate.value : { available: false, error: heartRate.reason?.message },
    activity: activity.status === "fulfilled" ? activity.value : { available: false, error: activity.reason?.message },
    weight: weight.status === "fulfilled" ? weight.value : { available: false, error: weight.reason?.message },
    fetchTime: new Date().toISOString(),
  };
}

module.exports = {
  getSleep,
  getHeartRate,
  getActivity,
  getWeight,
  getPai,
  getAllHealthData,
  formatDate,
};
