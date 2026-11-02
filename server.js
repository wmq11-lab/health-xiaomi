/**
 * 云朵收容所 · 健康数据后端
 *
 * 对接小米运动健康（华米 Huami）云 API，
 * 为前端提供真实健康数据接口。
 *
 * 启动: node server.js
 * 配置: 复制 .env.example 为 .env 并填写小米账号信息
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { authenticate } = require("./lib/xiaomi-auth");
const xiaomiData = require("./lib/xiaomi-data");

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(__dirname));

// 认证信息缓存
let authCache = null;
let authExpiry = 0;
const TOKEN_TTL = 55 * 60 * 1000; // 55 分钟刷新一次

/**
 * 获取有效认证（带缓存）
 */
async function getAuth() {
  if (!process.env.XIAOMI_USERNAME || !process.env.XIAOMI_PASSWORD) {
    throw new Error("未配置小米账号。请在 .env 文件中填写 XIAOMI_USERNAME 和 XIAOMI_PASSWORD");
  }

  if (authCache && Date.now() < authExpiry) {
    return authCache;
  }

  authCache = await authenticate(
    process.env.XIAOMI_USERNAME,
    process.env.XIAOMI_PASSWORD,
    process.env.XIAOMI_REGION || "cn"
  );
  authExpiry = Date.now() + TOKEN_TTL;
  console.log("[认证] 华米 token 已刷新");
  return authCache;
}

// ============ API 路由 ============

/**
 * 健康检查 / 配置状态
 */
app.get("/api/status", (req, res) => {
  const configured = !!(
    process.env.XIAOMI_USERNAME && process.env.XIAOMI_PASSWORD
  );
  res.json({
    configured,
    authenticated: !!authCache && Date.now() < authExpiry,
    region: process.env.XIAOMI_REGION || "cn",
  });
});

/**
 * 登录认证（可选：运行时通过接口配置）
 */
app.post("/api/login", async (req, res) => {
  try {
    const { username, password, region } = req.body;

    // 可以用请求参数，也可以用环境变量
    const user = username || process.env.XIAOMI_USERNAME;
    const pass = password || process.env.XIAOMI_PASSWORD;
    const reg = region || process.env.XIAOMI_REGION || "cn";

    if (!user || !pass) {
      return res
        .status(400)
        .json({ ok: false, error: "缺少用户名或密码" });
    }

    authCache = await authenticate(user, pass, reg);
    authExpiry = Date.now() + TOKEN_TTL;

    res.json({
      ok: true,
      userId: authCache.userId,
      message: "认证成功",
    });
  } catch (err) {
    console.error("[认证失败]", err.message);
    res.status(401).json({ ok: false, error: err.message });
  }
});

/**
 * 获取全部健康数据（聚合）
 */
app.get("/api/health", async (req, res) => {
  try {
    const auth = await getAuth();
    const data = await xiaomiData.getAllHealthData(auth);
    res.json({ ok: true, data });
  } catch (err) {
    console.error("[数据获取失败]", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 睡眠数据
 */
app.get("/api/health/sleep", async (req, res) => {
  try {
    const auth = await getAuth();
    const days = parseInt(req.query.days) || 30;
    const data = await xiaomiData.getSleep(auth, days);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 心率数据
 */
app.get("/api/health/heart-rate", async (req, res) => {
  try {
    const auth = await getAuth();
    const days = parseInt(req.query.days) || 30;
    const data = await xiaomiData.getHeartRate(auth, days);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 步数 / 运动数据
 */
app.get("/api/health/activity", async (req, res) => {
  try {
    const auth = await getAuth();
    const days = parseInt(req.query.days) || 30;
    const data = await xiaomiData.getActivity(auth, days);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * 体重 / 体成分
 */
app.get("/api/health/weight", async (req, res) => {
  try {
    const auth = await getAuth();
    const days = parseInt(req.query.days) || 30;
    const data = await xiaomiData.getWeight(auth, days);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * PAI 指数
 */
app.get("/api/health/pai", async (req, res) => {
  try {
    const auth = await getAuth();
    const data = await xiaomiData.getPai(auth);
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * SPA 路由回退到 index.html
 */
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  const configured = !!(
    process.env.XIAOMI_USERNAME && process.env.XIAOMI_PASSWORD
  );
  console.log(`\n  ☁  云朵收容所后端已启动`);
  console.log(`  →  http://localhost:${PORT}`);
  console.log(
    configured
      ? `  ✓  小米账号已配置（${process.env.XIAOMI_REGION || "cn"}）`
      : `  ⚠  未配置小米账号，请复制 .env.example 为 .env 并填写账号信息`
  );
  console.log(`\n`);
});
