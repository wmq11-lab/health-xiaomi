/**
 * 小米运动健康（华米 Huami）云 API 认证模块
 *
 * 认证流程：
 * 1. 登录小米账号 → 获取 serviceToken + userId
 * 2. 用 serviceToken 登录华米平台 → 获取 appToken
 * 3. 后续所有数据请求携带 appToken
 */

const crypto = require("crypto");
const fetch = require("node-fetch");

const HUAMI_APP_ID = "com.huami.watch.hmwatchmanager";

function genDeviceId() {
  return "xx" + Math.random().toString(16).slice(2, 14);
}

/**
 * 第一步：登录小米账号
 * 返回 serviceToken 和 userId
 */
async function loginXiaomiAccount(username, password, region = "cn") {
  const host = "account.xiaomi.com";

  // 先请求登录页面获取初始 cookie
  const loginPageUrl = `https://${host}/pass/serviceLogin?sid=passport-sdk-4-1&_locale=zh_CN`;
  const pageRes = await fetch(loginPageUrl, {
    headers: {
      "User-Agent":
        "MiFit/1.0 (com.huami.watch.hmwatchmanager; build:1; iOS 16.0.0)",
    },
    redirect: "manual",
  });
  const setCookies = pageRes.headers.raw()["set-cookie"] || [];
  const cookies = setCookies.map((c) => c.split(";")[0]).join("; ");

  // 登录认证
  const loginAuthUrl = `https://${host}/pass/serviceLoginAuth2`;
  const hashedPassword = Buffer.from(
    crypto.createHash("md5").update(password).digest("hex")
  ).toString("base64");

  const body = new URLSearchParams({
    sid: "passport-sdk-4-1",
    _locale: "zh_CN",
    callback: "https://api-mifit.huami.com/v1/app/login",
    qs: "%3Fsid%3Dpassport-sdk-4-1%26_locale%3Dzh_CN",
    _sign: "",
    user: username,
    hash: hashedPassword,
    _json: "true",
  });

  const authRes = await fetch(loginAuthUrl, {
    method: "POST",
    headers: {
      "User-Agent":
        "MiFit/1.0 (com.huami.watch.hmwatchmanager; build:1; iOS 16.0.0)",
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies,
    },
    body: body.toString(),
  });

  let authText = await authRes.text();
  // 小米返回的 JSON 有时以 )]}' 开头，需要清理
  const jsonStart = authText.indexOf("{");
  const jsonEnd = authText.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd >= 0) {
    authText = authText.substring(jsonStart, jsonEnd + 1);
  }
  const authData = JSON.parse(authText);

  if (authData.code !== 0) {
    const err = new Error(
      `小米账号登录失败: ${authData.desc || authData.message || authData.code}`
    );
    err.code = authData.code;
    err.data = authData;
    throw err;
  }

  // 提取 serviceToken
  const newCookies = authRes.headers.raw()["set-cookie"] || [];
  const allCookies = [
    ...setCookies.map((c) => c.split(";")[0]),
    ...newCookies.map((c) => c.split(";")[0]),
  ];
  const cookieStr = [...new Set(allCookies)].join("; ");
  const serviceTokenMatch = cookieStr.match(/serviceToken=([^;]+)/);
  const serviceToken = serviceTokenMatch
    ? serviceTokenMatch[1]
    : authData.token;

  return {
    userId: String(authData.uid),
    serviceToken,
    cUserId: String(authData.cuid || authData.uid),
    cookies: cookieStr,
  };
}

/**
 * 第二步：用小米账号 token 登录华米平台
 * 返回 appToken（后续数据请求需要）
 */
async function loginHuami(xiaomiLogin, region = "cn") {
  const deviceId = genDeviceId();
  const host = "api-mifit.huami.com";

  // 构造 login_url（小米 OAuth 回调地址）
  const loginUrl =
    `https://account.xiaomi.com/pass/serviceLoginAuth?sid=passport-sdk-4-1&followup=` +
    encodeURIComponent(`https://${host}/v1/app/login`) +
    `&clientId=HuaMi`;

  const body = new URLSearchParams({
    login_url: loginUrl,
    login_token: xiaomiLogin.serviceToken,
    app_id: HUAMI_APP_ID,
    device_id: deviceId,
    third_name: "xiaomi",
    _json: "true",
    country_code: region,
    user_id: xiaomiLogin.cUserId,
  });

  const res = await fetch(`https://${host}/v1/app/login`, {
    method: "POST",
    headers: {
      "User-Agent":
        "MiFit/1.0 (com.huami.watch.hmwatchmanager; build:1; iOS 16.0.0)",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  let text = await res.text();
  const jsonStart = text.indexOf("{");
  const jsonEnd = text.lastIndexOf("}");
  if (jsonStart >= 0 && jsonEnd >= 0) {
    text = text.substring(jsonStart, jsonEnd + 1);
  }
  const data = JSON.parse(text);

  if (data.error_code && data.error_code !== 0) {
    throw new Error(`华米登录失败: ${data.error_msg || data.error_code}`);
  }

  return {
    appToken: data.token_info.app_token,
    userId: data.token_info.user_id,
    deviceId,
    region,
    loginTime: Date.now(),
  };
}

/**
 * 完整认证流程：小米账号 → 华米平台
 * 返回带 appToken 的认证信息
 */
async function authenticate(username, password, region = "cn") {
  const xiaomiLogin = await loginXiaomiAccount(username, password, region);
  const huamiLogin = await loginHuami(xiaomiLogin, region);
  return huamiLogin;
}

module.exports = {
  authenticate,
  loginXiaomiAccount,
  loginHuami,
};
