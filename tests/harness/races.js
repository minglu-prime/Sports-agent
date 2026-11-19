// Race repro for the thread bugs, run in the harness page after localStorage.clear() + reload. Returns a result object; all checks true = fixed.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const idle = async () => { for (let i = 0; i < 100 && (state.ctl || document.querySelector(".typing")); i++) await wait(100); await wait(200); };
  const db = () => JSON.parse(localStorage.getItem("mockdb") || "{}");
  const threadIds = () => Object.entries(db()["data/users/u1"] || {}).filter(([, v]) => v.kind === "thread").map(([k]) => k);
  window.__dbDelay = 0;
  $("text").value = "练快攻"; await send(); await idle();
  const t1 = state.tid;
  const out = {};

  // R1: second send while the first one is still creating its thread
  window.__dbDelay = 300;
  await openThread(null);
  const before = threadIds().length;
  $("text").value = "第一条"; send();
  await wait(50);
  $("text").value = "第二条"; send();
  await idle();
  out.r1_oneNewThread = threadIds().length - before === 1;

  // R2: coach switches thread while a new thread is being created
  await openThread(null);
  $("text").value = "切走"; send();
  await wait(50);
  await openThread(t1);
  await idle(); await wait(400);
  out.r2_staysOnT1 = state.tid === t1 && $("title").textContent === (state.threads.find((t) => t.id === t1) || {}).title;

  // R3: mark held, switch away before the write returns
  window.__dbDelay = 300;
  await openThread(t1); await wait(700);
  const heldBtn = [...document.querySelectorAll(".card-actions button")].find((b) => b.textContent === "标记已上课");
  const planId = heldBtn && heldBtn.closest(".msg").dataset.id;
  heldBtn.click();
  await wait(50);
  await openThread(threadIds().find((x) => x !== t1));
  await wait(1500);
  out.r3_heldDocInRightThread = Object.keys(db()["data/users/u1"]).includes(`h_${t1}_${planId}`);
  // R4: send while a thread is still loading: refused with a notice, nothing lost
  window.__dbDelay = 600;
  const other = threadIds().find((x) => x !== state.tid);
  openThread(other); await wait(50);
  $("text").value = "加载中发送"; await send();
  out.r4_refused_while_loading = $("text").value === "加载中发送" && [...document.querySelectorAll(".msg")].some((n) => n.textContent.includes("还在加载"));
  await wait(1500);
  window.__dbDelay = 0;

  // R5: model answers with null entries: card renders, thread reopens fine
  const d = (n, m) => ({ name: n, minuten: m, ziele: ["反应"], aufbau: "a", regeln: "r", wettkampf: "w", coachingCue: "c", leichter: "l", schwerer: "s" });
  window.__planOverride = { titel: "脏数据", phasen: [null, { id: "aufwaermen", minuten: 12, uebungen: [null, d("跑", 12)] }, { id: "mobilisation", minuten: 10, uebungen: [d("跳", 10)] }, { id: "aktivierung", minuten: 8, uebungen: [d("新反应", 8)] }, { id: "technik", minuten: 35, uebungen: [d("技", 35)] }, { id: "spiel", minuten: 25, uebungen: [d("赛", 25)] }] };
  $("text").value = "脏数据"; await send(); await idle();
  window.__planOverride = null;
  const tidNow = state.tid; await openThread(t1); await wait(300); await openThread(tidNow); await wait(500);
  out.r5_null_entries_render = [...document.querySelectorAll(".plan h2")].some((h) => h.textContent.includes("脏数据"));
  return out;
})();
