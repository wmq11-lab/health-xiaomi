const screens = [...document.querySelectorAll(".screen")];
const navItems = [...document.querySelectorAll(".nav-item")];
const goButtons = [...document.querySelectorAll("[data-go]")];
const detailTriggers = [...document.querySelectorAll("[data-detail]")];
const sheet = document.getElementById("detail-sheet");
const sheetContent = document.getElementById("sheet-content");
const sheetBackdrop = document.getElementById("sheet-backdrop");
const sheetClose = document.getElementById("sheet-close");
const toast = document.getElementById("toast");
const safetyOverlay = document.getElementById("safety-overlay");
const safetyClose = document.getElementById("safety-close");
const triageContent = document.getElementById("triage-content");
const safetyPanel = document.querySelector(".safety-panel");
let toastTimer;
let lastFocusedElement = null;
let detectiveSelections = new Set();
let triageRiskSelections = new Set();
let triageOtherSelections = new Set();

const details = {
  sleep: {
    eyebrow: "昨夜云层 · 11月1日",
    title: "睡了 6 小时 42 分",
    icon: "i-moon",
    summary: "比你的 30 天平均少 18 分钟。夜里醒了 2 次，第二次在 03:46。",
    insight: "今天先给日程留一点空白。午后晒 10 分钟太阳，晚上会比平时更容易入睡。",
    chart: pointsForSleep,
    labels: ["23:12", "00:30", "02:00", "03:30", "05:00", "06:10"],
    footnote: "睡眠数据来自小米运动健康，最近同步于 08:16。单次睡眠波动不能用于诊断。",
  },
  heart: {
    eyebrow: "安静心跳 · 近 24 小时",
    title: "静息心率 62 bpm",
    icon: "i-heart",
    summary: "位于你常见范围 56–66 bpm 内，比 30 天平均高 3 bpm，不需要紧张。",
    insight: "昨晚少睡和今天开头偏忙都可能让它暂时升高。先补水，走动 3 分钟，再看下午趋势。",
    chart: pointsForHeart,
    labels: ["0时", "4时", "8时", "12时", "16时", "20时"],
    footnote: "心率数据佩戴存在误差。如果伴随胸痛、呼吸困难或晕厥，请立即联系急救，不要依赖本应用。",
  },
  mood: {
    eyebrow: "心情便签 · 今天",
    title: "安安静静",
    icon: "i-leaf",
    summary: "你记下了一点困、一点平静，也知道今天不用把所有事情都做得很好。",
    insight: "可以给小云补一句：此刻最想被照顾的是什么？有时写出来，事情就会轻一点。",
    chart: pointsForMood,
    labels: ["昨天", "凌晨", "早上", "现在", "", ""],
    footnote: "心情便签只用于回顾与陪伴，不替代心理或医疗评估。",
  },
};

function pointsForSleep() {
  return "M2 67C36 61 51 30 79 39S113 74 142 55s39-24 69-13 54 17 82 0";
}

function pointsForHeart() {
  return "M2 60C27 63 42 48 68 52s31 25 55 18 30-34 56-27 33 28 59 20 35-17 55-12";
}

function pointsForMood() {
  return "M2 64C35 59 46 43 78 49s34 27 66 17 30-28 63-19 45 16 86 6";
}

function showScreen(name) {
  screens.forEach((screen) => {
    const isCurrent = screen.dataset.screen === name;
    screen.classList.toggle("is-active", isCurrent);
    screen.setAttribute("aria-hidden", String(!isCurrent));
    if (isCurrent) screen.scrollTop = 0;
  });
  navItems.forEach((item) => {
    item.classList.toggle("is-current", item.dataset.go === name);
  });
  if (name !== "breathe" && breathRunning) stopBreathing();
}

goButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    showScreen(button.dataset.go);
  });
});

function chartMarkup(detail) {
  return `
    <div class="sheet-chart" aria-label="健康趋势图">
      <svg viewBox="0 0 300 110" role="img">
        <path class="chart-area" d="${detail.chart()}L298 110L2 110Z"></path>
        <path class="chart-line" d="${detail.chart()}"></path>
        <circle class="chart-dot" cx="2" cy="64" r="4"></circle>
        <circle class="chart-dot" cx="140" cy="51" r="4"></circle>
        <circle class="chart-dot" cx="298" cy="42" r="4"></circle>
      </svg>
      <div class="chart-labels">${detail.labels.map((label) => `<span>${label}</span>`).join("")}</div>
    </div>
  `;
}

function openDetail(kind, returnTarget = document.activeElement) {
  const detail = details[kind];
  if (!detail) return;
  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#${detail.icon}"></use></svg></span>
      <div>
        <small>${detail.eyebrow}</small>
        <h2 id="sheet-title">${detail.title}</h2>
      </div>
    </div>
    <p class="sheet-summary">${detail.summary}</p>
    ${chartMarkup(detail)}
    <div class="sheet-insight">
      <svg><use href="#i-spark"></use></svg>
      <span>${detail.insight}</span>
    </div>
    <div class="sheet-actions">
      <button class="sheet-action" data-open-baseline>和我的 30 天基线比较</button>
      <button class="sheet-action secondary" data-open-detective>说说发生了什么</button>
    </div>
    <p class="sheet-footnote">${detail.footnote}</p>
    ${
      kind === "heart"
        ? '<div class="red-flag">胸痛、明显呼吸困难、冒冷汗或接近晕厥属于需要及时求助的情况。<button class="inline-safety-link" data-open-triage>先检查是否需要立即求助</button></div>'
        : ""
    }
  `;
  openSheetBase(returnTarget);
}

function closeDetail() {
  const returnTarget = lastFocusedElement;
  sheet.classList.remove("is-open");
  sheetBackdrop.classList.remove("is-open");
  document.body.style.overflow = "";
  if (returnTarget instanceof HTMLElement) {
    returnTarget.focus({ preventScroll: true });
  }
  sheet.setAttribute("aria-hidden", "true");
}

detailTriggers.forEach((trigger) => {
  trigger.addEventListener("click", (event) => openDetail(trigger.dataset.detail, event.currentTarget));
});

sheetClose.addEventListener("click", closeDetail);
sheetBackdrop.addEventListener("click", closeDetail);

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (safetyOverlay.classList.contains("is-open")) closeSafetyTriage();
  else closeDetail();
});

document.getElementById("open-settings").addEventListener("click", (event) => showSettings(event.currentTarget));
document.getElementById("open-sync").addEventListener("click", (event) => showSync(event.currentTarget));
document.getElementById("journal-sync").addEventListener("click", (event) => showSync(event.currentTarget));
document.getElementById("open-triage").addEventListener("click", (event) => {
  openSafetyTriage(event.currentTarget);
});
safetyClose.addEventListener("click", closeSafetyTriage);

document.addEventListener("click", (event) => {
  const baselineTrigger = event.target.closest("[data-open-baseline]");
  if (baselineTrigger) {
    openBaseline(baselineTrigger);
    return;
  }

  const detectiveTrigger = event.target.closest("[data-open-detective]");
  if (detectiveTrigger) {
    openDetective(detectiveTrigger);
    return;
  }

  const triageTrigger = event.target.closest("[data-open-triage]");
  if (triageTrigger) {
    const returnTarget = lastFocusedElement || triageTrigger;
    if (sheet.classList.contains("is-open")) closeDetail();
    openSafetyTriage(returnTarget);
  }
});

function showSync(returnTarget = document.activeElement) {
  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-cloud"></use></svg></span>
      <div>
        <small>HEALTH CONNECT</small>
        <h2 id="sheet-title">小米数据已进云</h2>
      </div>
    </div>
    <p class="sheet-summary">最近一次同步发生在今天 08:16。数据只用于生成你的健康便签，未经允许不会发送给其他云朵。</p>
    <div class="sync-list">
      <div class="sync-row"><span>睡眠与清醒次数</span><span>已更新</span></div>
      <div class="sync-row"><span>静息心率</span><span>已更新</span></div>
      <div class="sync-row"><span>步数与运动</span><span>已更新</span></div>
      <div class="sync-row"><span>血氧 / HRV</span><span>未开放</span></div>
    </div>
    <button class="sync-action" id="sync-now">再同步一次</button>
    <p class="sheet-footnote">真实接入时需要逐项申请 Health Connect 权限。不同小米设备支持的数据类型可能不同。</p>
  `;
  openSheetBase(returnTarget);
  document.getElementById("sync-now").addEventListener("click", () => {
    const button = document.getElementById("sync-now");
    button.textContent = "刚刚完成同步";
    showToast("云层已经更新");
  });
}

function showSettings(returnTarget = document.activeElement) {
  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-settings"></use></svg></span>
      <div>
        <small>YOUR LITTLE SKY</small>
        <h2 id="sheet-title">小云的设置</h2>
      </div>
    </div>
    <p class="sheet-summary">这里决定哪些数据可以进入你的云层，以及什么时候收到轻轻的提醒。</p>
    <div class="sync-list">
      <div class="sync-row"><span>小米运动健康同步</span><span>已连接</span></div>
      <div class="sync-row"><span>AI 便签</span><span>已开启</span></div>
      <div class="sync-row"><span>轻柔提醒</span><span>每天最多 2 次</span></div>
      <div class="sync-row"><span>重要健康提示</span><span>始终开启</span></div>
    </div>
    <div class="sheet-actions">
      <button class="sheet-action" data-open-baseline>查看个人基线</button>
      <button class="sheet-action secondary" data-open-triage>安全分诊</button>
    </div>
    <p class="sheet-footnote">治愈感不等于弱化风险。严重症状和危急数值始终使用清楚的文字与颜色呈现。</p>
  `;
  openSheetBase(returnTarget);
}

function openSheetBase(returnTarget = document.activeElement) {
  if (!sheet.classList.contains("is-open")) {
    lastFocusedElement = returnTarget;
  }
  sheet.classList.add("is-open");
  sheet.setAttribute("aria-hidden", "false");
  if (document.getElementById("sheet-title")) {
    sheet.setAttribute("aria-labelledby", "sheet-title");
  }
  sheetBackdrop.classList.add("is-open");
  document.body.style.overflow = "hidden";
  sheetClose.focus({ preventScroll: true });
}

function openBaseline(returnTarget = document.activeElement) {
  const baselineDays = Array.from({ length: 28 }, (_, index) => {
    const missing = index === 6 || index === 19;
    return `<i class="${missing ? "is-missing" : ""}" aria-hidden="true"></i>`;
  }).join("");

  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-spark"></use></svg></span>
      <div>
        <small>YOUR OWN NORMAL · 最近 30 天</small>
        <h2 id="sheet-title">你的常用范围</h2>
      </div>
    </div>
    <div class="baseline-hero">
      <div class="baseline-hero-top">
        <span>28 天有效记录</span>
        <span class="baseline-confidence">仍在学习</span>
      </div>
      <h3>今天有 1 项离开了常用范围</h3>
      <p>基线会随着生活状态慢慢移动，它不是一条永远不能越过的线。</p>
      <div class="baseline-progress" aria-label="最近 28 天中已有 26 天有效记录">${baselineDays}</div>
    </div>
    <div class="baseline-metrics">
      <article class="baseline-metric">
        <div class="baseline-metric-head">
          <strong>睡眠时长</strong>
          <span>昨夜 6时42分</span>
        </div>
        <div class="range-track" aria-label="常用睡眠时长约 6小时50分到 7小时25分">
          <span class="range-zone" style="left:43%;width:28%"></span>
          <span class="range-marker is-outside" style="left:34%"></span>
        </div>
        <div class="range-labels"><span>5时</span><span>7时</span><span>9时</span></div>
      </article>
      <article class="baseline-metric">
        <div class="baseline-metric-head">
          <strong>夜间醒来</strong>
          <span>昨夜 2 次</span>
        </div>
        <div class="range-track" aria-label="常用夜间醒来次数为 0 到 1 次">
          <span class="range-zone" style="left:7%;width:34%"></span>
          <span class="range-marker is-outside" style="left:76%"></span>
        </div>
        <div class="range-labels"><span>0次</span><span>2次</span><span>4次</span></div>
      </article>
      <article class="baseline-metric">
        <div class="baseline-metric-head">
          <strong>静息心率</strong>
          <span>今天 62 bpm</span>
        </div>
        <div class="range-track" aria-label="常用静息心率为 56 到 66 bpm">
          <span class="range-zone" style="left:38%;width:30%"></span>
          <span class="range-marker" style="left:54%"></span>
        </div>
        <div class="range-labels"><span>45</span><span>56–66</span><span>75</span></div>
      </article>
    </div>
    <div class="baseline-callout">
      <svg><use href="#i-spark"></use></svg>
      <span>与“和你自己相比”不同，人群标准不适合判断每天的微小变化。连续记录越稳定，解释越可靠。</span>
    </div>
    <div class="sheet-actions">
      <button class="sheet-action" data-open-detective>找找这次变化的原因</button>
      <button class="sheet-action secondary" data-open-triage>检查危险症状</button>
    </div>
    <p class="sheet-footnote">当前为演示数据。正式版本应显示样本量、缺失天数、数据来源和每项指标的更新时间。个人基线不用于诊断。</p>
  `;
  openSheetBase(returnTarget);
}

const detectiveOptions = [
  { id: "late", label: "比平时晚睡" },
  { id: "stimulant", label: "喝了咖啡或茶" },
  { id: "meal", label: "晚饭比较晚" },
  { id: "alcohol", label: "喝过酒" },
  { id: "stress", label: "压力比较大" },
  { id: "unwell", label: "身体不太舒服" },
  { id: "cycle", label: "经期前后" },
  { id: "unclear", label: "有点想不起来" },
];

function openDetective(returnTarget = document.activeElement) {
  detectiveSelections = new Set();
  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-cloud"></use></svg></span>
      <div>
        <small>身体变化侦探 · 第 1 步</small>
        <h2 id="sheet-title">昨晚有什么不同？</h2>
      </div>
    </div>
    <p class="detective-question">昨夜比你的常用范围多醒了 1 次。可以多选，也可以不回答。</p>
    <div class="detective-options" role="group" aria-label="昨晚可能不同的情况">
      ${detectiveOptions
        .map(
          (option) => `
            <button class="choice-option" data-detective-choice="${option.id}" aria-pressed="false">
              ${option.label}
            </button>
          `
        )
        .join("")}
    </div>
    <div class="sheet-actions">
      <button class="sheet-action" id="detective-check">看看可能的线索</button>
      <button class="sheet-action secondary" data-open-baseline>先看我的基线</button>
    </div>
    <p class="uncertainty-note">这些答案只用于寻找同时发生的变化，不能证明某个行为就是原因。</p>
  `;
  openSheetBase(returnTarget);

  document.querySelectorAll("[data-detective-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.detectiveChoice;
      if (choice === "unclear") {
        detectiveSelections.clear();
        detectiveSelections.add("unclear");
      } else {
        detectiveSelections.delete("unclear");
        if (detectiveSelections.has(choice)) detectiveSelections.delete(choice);
        else detectiveSelections.add(choice);
      }
      document.querySelectorAll("[data-detective-choice]").forEach((optionButton) => {
        optionButton.setAttribute(
          "aria-pressed",
          String(detectiveSelections.has(optionButton.dataset.detectiveChoice))
        );
      });
    });
  });

  document.getElementById("detective-check").addEventListener("click", showDetectiveResult);
}

function showDetectiveResult() {
  const selected = detectiveOptions.filter(
    (option) => detectiveSelections.has(option.id) && option.id !== "unclear"
  );
  const labels = selected.map((option) => option.label);
  const hasContext = labels.length > 0;
  const title = hasContext
    ? `「${labels.slice(0, 2).join("、")}」可能让云层变重`
    : "这次变化暂时没有明显线索";
  const explanation = hasContext
    ? `昨夜多醒的 1 次，和“${labels.join("、")}”同时出现。先不用把它当成原因，今晚只改变一个条件，再看明天有没有不同。`
    : "没有线索不代表身体在说谎。一次夜间波动很常见，今晚继续按平常节奏休息，明天再回来看这一朵云。";
  const unwellSelected = detectiveSelections.has("unwell");

  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-spark"></use></svg></span>
      <div>
        <small>身体变化侦探 · 线索已收好</small>
        <h2 id="sheet-title">一朵可能有关的云</h2>
      </div>
    </div>
    <div class="detective-result-mark"><svg><use href="#i-cloud"></use></svg></div>
    <h3 class="detective-result-title">${title}</h3>
    <p class="detective-result-copy">${explanation}</p>
    <div class="sheet-insight">
      <svg><use href="#i-spark"></use></svg>
      <span>今晚可以从一件小事开始：比平时提前 20 分钟放下手机，明天早上看这朵云会不会轻一点。</span>
    </div>
    ${
      unwellSelected
        ? '<div class="red-flag">你同时选择了“身体不太舒服”。如果症状明显、持续或正在加重，请联系医生；出现胸痛、呼吸困难或晕厥时立即求助。<button class="inline-safety-link" data-open-triage>检查危险症状</button></div>'
        : ""
    }
    <div class="sheet-actions">
      <button class="sheet-action" id="start-observation">记下今晚的观察</button>
      <button class="sheet-action secondary" id="rerun-detective">重新选一次</button>
    </div>
    <p class="uncertainty-note">身体变化侦探只分析相关线索，不做疾病诊断。持续或明显的不适应交给专业医生判断。</p>
  `;
  openSheetBase();
  document.getElementById("start-observation").addEventListener("click", () => {
    closeDetail();
    showToast("今晚的小观察已经放进云里");
  });
  document.getElementById("rerun-detective").addEventListener("click", openDetective);
}

const triageRiskOptions = [
  { id: "chest", label: "突然胸痛、压迫感或胸口发紧" },
  { id: "breathing", label: "明显喘不上气或呼吸困难" },
  { id: "fainting", label: "晕倒、快要晕倒或意识不清" },
  { id: "stroke", label: "单侧无力、口角歪斜或说话不清" },
  { id: "bleeding", label: "大量出血、严重过敏或症状迅速加重" },
];

const triageOtherOptions = [
  { id: "fever", label: "发热" },
  { id: "pain", label: "持续或明显的疼痛" },
  { id: "dizziness", label: "持续头晕" },
  { id: "vomiting", label: "反复呕吐或无法进水" },
  { id: "mood", label: "情绪或睡眠问题持续困扰" },
];

function openSafetyTriage(returnTarget = document.activeElement) {
  lastFocusedElement = returnTarget;
  triageRiskSelections = new Set();
  triageOtherSelections = new Set();
  renderTriageRiskStep();
  safetyOverlay.classList.add("is-open");
  safetyOverlay.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  safetyClose.focus({ preventScroll: true });
}

function closeSafetyTriage() {
  const returnTarget = lastFocusedElement;
  safetyOverlay.classList.remove("is-open");
  safetyOverlay.setAttribute("aria-hidden", "true");
  if (!sheet.classList.contains("is-open")) document.body.style.overflow = "";
  window.setTimeout(() => {
    if (returnTarget instanceof HTMLElement) returnTarget.focus({ preventScroll: true });
  }, 360);
}

safetyOverlay.addEventListener("click", (event) => {
  if (event.target === safetyOverlay) closeSafetyTriage();
});

function renderTriageRiskStep() {
  safetyPanel.scrollTop = 0;
  triageContent.innerHTML = `
    <div class="triage-intro">
      <svg><use href="#i-alert"></use></svg>
      <span>这不是疾病诊断。先快速排查看似不典型、但可能需要急救的情况；不确定时可以选择联系医生。</span>
    </div>
    <section class="triage-step" aria-labelledby="risk-step-title">
      <span class="triage-step-count">STEP 1 / 2 · 立即风险</span>
      <h2 id="risk-step-title">现在有没有这些情况？</h2>
      <p>可以多选。如果症状刚刚发生或正在加重，请直接求助。</p>
      <div class="risk-grid" role="group" aria-label="需要立即求助的症状">
        ${triageRiskOptions
          .map(
            (option) => `
              <button class="risk-option" data-risk-choice="${option.id}" aria-pressed="false">
                ${option.label}
              </button>
            `
          )
          .join("")}
      </div>
      <button class="triage-continue" id="risk-continue">都没有这些情况，继续</button>
      <button class="triage-secondary" id="triage-ask-doctor">我不确定，想先联系医生</button>
      <p class="safety-footnote">如果正在发生严重症状，请优先拨打当地急救电话。中国大陆可拨打 120。</p>
    </section>
  `;

  document.querySelectorAll("[data-risk-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.riskChoice;
      if (triageRiskSelections.has(choice)) triageRiskSelections.delete(choice);
      else triageRiskSelections.add(choice);
      button.setAttribute("aria-pressed", String(triageRiskSelections.has(choice)));
    });
  });

  document.getElementById("risk-continue").addEventListener("click", () => {
    if (triageRiskSelections.size > 0) renderEmergencyState();
    else renderTriageSecondaryStep();
  });
  document.getElementById("triage-ask-doctor").addEventListener("click", () => {
    renderMedicalAdviceState("如果症状在持续、反复或让你明显不安，请联系医生或当地医疗咨询热线。");
  });
}

function renderEmergencyState() {
  safetyPanel.scrollTop = 0;
  const selectedRisk = triageRiskOptions
    .filter((option) => triageRiskSelections.has(option.id))
    .map((option) => option.label);

  triageContent.innerHTML = `
    <div class="emergency-state">
      <span class="emergency-badge"><svg><use href="#i-alert"></use></svg>需要立即评估</span>
      <h2>先停止自查，马上求助。</h2>
      <p>你勾选了：${selectedRisk.join("、")}。这些症状可能需要急救，不能等待 AI 或普通健康建议。</p>
      <div class="emergency-checklist">
        现在拨打当地急救电话。中国大陆可拨打 120。<br />
        不要独自驾车。尽量保持坐卧舒适，并让身边的人知道。<br />
        如果症状已经缓解，也建议尽快接受医疗评估。
      </div>
      <a class="emergency-call" href="tel:120">拨打 120 急救电话</a>
      <button class="triage-secondary" id="triage-restart">重新检查症状</button>
      <button class="triage-secondary" id="triage-emergency-close">关闭，我先找人帮忙</button>
      <p class="safety-footnote">不同地区的急救号码不同。如果不在中国大陆，请拨打当地急救电话。</p>
    </div>
  `;
  document.getElementById("triage-restart").addEventListener("click", () => {
    triageRiskSelections.clear();
    renderTriageRiskStep();
  });
  document.getElementById("triage-emergency-close").addEventListener("click", closeSafetyTriage);
}

function renderTriageSecondaryStep() {
  safetyPanel.scrollTop = 0;
  triageContent.innerHTML = `
    <div class="triage-intro">
      <svg><use href="#i-spark"></use></svg>
      <span>目前没有勾选需要立即急救的症状。接下来看看有没有需要尽快联系医生的情况。</span>
    </div>
    <section class="triage-step" aria-labelledby="other-step-title">
      <span class="triage-step-count">STEP 2 / 2 · 其他持续症状</span>
      <h2 id="other-step-title">还有其他不舒服吗？</h2>
      <p>可以多选；没有也可以直接继续。</p>
      <div class="risk-grid" role="group" aria-label="其他持续症状">
        ${triageOtherOptions
          .map(
            (option) => `
              <button class="risk-option" data-other-choice="${option.id}" aria-pressed="false">
                ${option.label}
              </button>
            `
          )
          .join("")}
      </div>
      <button class="triage-continue" id="other-continue">看看下一步</button>
      <button class="triage-secondary" id="other-back">返回上一步</button>
      <p class="safety-footnote">如果你不确定症状是否严重，联系医生比继续猜测更安全。</p>
    </section>
  `;

  document.querySelectorAll("[data-other-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      const choice = button.dataset.otherChoice;
      if (triageOtherSelections.has(choice)) triageOtherSelections.delete(choice);
      else triageOtherSelections.add(choice);
      button.setAttribute("aria-pressed", String(triageOtherSelections.has(choice)));
    });
  });

  document.getElementById("other-back").addEventListener("click", renderTriageRiskStep);
  document.getElementById("other-continue").addEventListener("click", () => {
    if (triageOtherSelections.size > 0) {
      const labels = triageOtherOptions
        .filter((option) => triageOtherSelections.has(option.id))
        .map((option) => option.label);
      renderMedicalAdviceState(
        `你记录了“${labels.join("、")}”。建议联系医生或当地医疗咨询热线，说明症状从什么时候开始、是否在加重。`
      );
    } else {
      renderMedicalAdviceState(
        "你没有勾选当前问题中的危险症状。AI 仍然无法排除所有疾病；如果症状持续、加重，或你感到明显不安，请联系医生。"
      );
    }
  });
}

function renderMedicalAdviceState(message) {
  safetyPanel.scrollTop = 0;
  triageContent.innerHTML = `
    <div class="triage-intro">
      <svg><use href="#i-spark"></use></svg>
      <span>安全分诊只提供求助方向，不能确定病因，也不能替代医生检查。</span>
    </div>
    <section class="triage-step">
      <span class="triage-step-count">下一步建议</span>
      <h2>把不确定交给专业的人</h2>
      <p>${message}</p>
      <div class="emergency-checklist">
        记录症状开始时间、频率和严重程度。<br />
        记录是否伴随发热、胸痛、呼吸困难或晕厥。<br />
        如果出现新的红旗症状，请立即拨打当地急救电话。
      </div>
      <button class="triage-continue" id="advice-restart">重新检查</button>
      <button class="triage-secondary" id="advice-close">先关闭</button>
      <p class="safety-footnote">症状快速变化时，不要等待 AI 回复或继续观察。</p>
    </section>
  `;
  document.getElementById("advice-restart").addEventListener("click", () => {
    triageRiskSelections.clear();
    triageOtherSelections.clear();
    renderTriageRiskStep();
  });
  document.getElementById("advice-close").addEventListener("click", closeSafetyTriage);
}

const rewardMessages = {
  hydration: "小云收下了一口清水",
  stretch: "一缕风推着云飘了起来",
};

document.querySelectorAll("[data-reward]").forEach((button) => {
  button.addEventListener("click", () => {
    const starCount = document.getElementById("stars");
    starCount.textContent = String(Number(starCount.textContent) + 1);
    showToast(rewardMessages[button.dataset.reward]);
    button.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(0.96) rotate(-1deg)" },
        { transform: "scale(1)" },
      ],
      { duration: 280, easing: "ease-out" }
    );
  });
});

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.querySelector("span").textContent = message;
  toast.classList.add("is-visible");
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 1800);
}

const breathCloud = document.getElementById("breathing-cloud");
const breathStart = document.getElementById("breath-start");
const breathPhase = document.getElementById("breath-phase");
const breathInstruction = document.getElementById("breath-instruction");
const breathTimerLabel = document.getElementById("breath-timer");
const breathButtonLabel = document.getElementById("breath-button-label");
let breathRunning = false;
let breathStartedAt = 0;
let breathFrame = 0;
let breathePhaseIndex = -1;

const breathPhases = [
  { start: 0, end: 4, phase: "轻轻吸气", instruction: "让云朵慢慢变大", timer: "吸气 · 4 秒" },
  { start: 4, end: 8, phase: "短暂停留", instruction: "让身体停在云里", timer: "停留 · 4 秒" },
  { start: 8, end: 14, phase: "慢慢呼气", instruction: "让肩膀一起落下来", timer: "呼气 · 6 秒" },
];

function startBreathing() {
  breathRunning = true;
  breathStartedAt = performance.now();
  breathePhaseIndex = -1;
  breathCloud.classList.add("is-active");
  breathStart.classList.add("is-running");
  breathButtonLabel.textContent = "停下来";
  breathLoop();
}

function stopBreathing() {
  breathRunning = false;
  window.cancelAnimationFrame(breathFrame);
  breathCloud.classList.remove("is-active");
  breathStart.classList.remove("is-running");
  breathButtonLabel.textContent = "再呼吸一次";
  breathPhase.textContent = "小云陪你";
  breathInstruction.textContent = "想停的时候，随时可以停";
  breathTimerLabel.textContent = "已经完成一次温柔的照顾";
}

function breathLoop(now = performance.now()) {
  if (!breathRunning) return;
  const elapsed = (now - breathStartedAt) / 1000;
  if (elapsed >= 60) {
    stopBreathing();
    return;
  }
  const cycle = elapsed % 14;
  const nextIndex = breathPhases.findIndex((phase) => cycle >= phase.start && cycle < phase.end);
  if (nextIndex !== breathePhaseIndex) {
    breathePhaseIndex = nextIndex;
    const current = breathPhases[nextIndex];
    breathPhase.textContent = current.phase;
    breathInstruction.textContent = current.instruction;
    breathTimerLabel.textContent = current.timer;
  }
  const remaining = Math.max(0, 60 - elapsed);
  breathStart.style.setProperty("--progress", `${(elapsed / 60) * 100}%`);
  breathButtonLabel.textContent = `停下来 · ${Math.ceil(remaining)}s`;
  breathFrame = window.requestAnimationFrame(breathLoop);
}

breathStart.addEventListener("click", () => {
  if (breathRunning) stopBreathing();
  else startBreathing();
});

breathCloud.addEventListener("click", () => {
  if (breathRunning) stopBreathing();
  else startBreathing();
});

const soundToggle = document.getElementById("sound-toggle");
let soundOn = false;
soundToggle.addEventListener("click", () => {
  soundOn = !soundOn;
  soundToggle.style.background = soundOn ? "#d8e7dc" : "";
  showToast(soundOn ? "风声已经轻轻打开" : "云室安静下来了");
});

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatStream = document.getElementById("chat-stream");

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.prompt;
    chatInput.focus();
  });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) {
    chatInput.focus();
    return;
  }

  const userNote = document.createElement("div");
  userNote.className = "chat-note user-note";
  userNote.innerHTML = `<div class="note-pin"></div><p></p><span>刚刚</span>`;
  userNote.querySelector("p").textContent = message;
  chatStream.appendChild(userNote);
  chatInput.value = "";

  const typing = document.createElement("div");
  typing.className = "typing-cloud";
  typing.innerHTML = "<i></i><i></i><i></i>";
  typing.setAttribute("aria-label", "小云正在回复");
  chatStream.appendChild(typing);
  typing.scrollIntoView({ behavior: "smooth", block: "nearest" });

  window.setTimeout(() => {
    typing.remove();
    const reply = document.createElement("div");
    reply.className = "chat-note ai-note";
    reply.innerHTML = `
      <div class="ai-cloud-avatar" aria-hidden="true"><i></i><i></i><b></b></div>
      <p></p>
      <span>刚刚 · 根据今天已同步的数据</span>
    `;
    let answer;
    if (message.includes("运动")) {
      answer = "今天更适合散步、舒展或轻一点的骑行。你昨晚少睡了一点，先不急着把训练塞满，身体舒服了再加一点力气。";
    } else if (message.includes("累") || message.includes("睡")) {
      answer = "我看到了几朵靠得比较低的云：睡得少一点、夜里多醒两次。今天先做一件能让肩膀放松的小事，不必马上解释所有疲惫。";
    } else {
      answer = "我把这句话收进云里了。结合你今天的睡眠和心跳，先给自己一点慢下来的空间；如果身体有明显不适，也可以把具体感受继续告诉我。";
    }
    reply.querySelector("p").textContent = answer;
    chatStream.appendChild(reply);
    reply.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, 1100);
});

document.getElementById("read-letter").addEventListener("click", (event) => {
  sheetContent.innerHTML = `
    <div class="sheet-header">
      <span class="sheet-icon"><svg><use href="#i-letter"></use></svg></span>
      <div>
        <small>第 07 封 · 11月1日</small>
        <h2 id="sheet-title">这周的云来信</h2>
      </div>
    </div>
    <p class="sheet-summary">小满，这一周你并没有每天都精神很好，但你开始更早地注意到累，也愿意停下来走一小段路。</p>
    <div class="sheet-insight">
      <svg><use href="#i-spark"></use></svg>
      <span>入睡时间比上周晚了 17 分钟，周末补回了 41 分钟。三次散步之后，你都记下了“轻了一点”。</span>
    </div>
    <p class="sheet-summary">下周不必立刻变成一张更完美的作息表。先把“困了就少安排一件事”继续做下去。</p>
    <div class="red-flag">周记中的趋势只适合自我回顾，不构成诊断或治疗建议。持续不适请咨询专业医生。</div>
  `;
  openSheetBase(event.currentTarget);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && breathRunning) stopBreathing();
});
