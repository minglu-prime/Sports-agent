// Main coach flow in the harness page, run after localStorage.clear() + reload. Every value true = pass.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const idle = async () => { for (let i = 0; i < 100 && (state.ctl || document.querySelector(".typing")); i++) await wait(100); await wait(300); };
  const btn = (t, root = document) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === t);
  const rowOf = (n) => [...document.querySelectorAll(".drill-wrap")].find((w) => w.querySelector("summary").textContent.includes(n));
  const lastPlan = () => [...document.querySelectorAll(".plan")].pop();
  const out = {};

  $("text").value = "练快攻"; send(); await idle();
  for (let i = 0; i < 50 && window.__calls.filter((c) => c === "detail").length < 5; i++) await wait(200);
  await wait(400);
  out.plan_with_5_pictures = lastPlan().querySelectorAll(".court-wrap svg").length === 5;
  out.no_draw_all_button_left = !btn("给整节课画图", lastPlan());

  btn("标记已上课").click(); await wait(400);
  out.held_tag = lastPlan().querySelector("h2").textContent.includes("已上课");
  rowOf("头胸球").querySelectorAll(".drill-tools button")[1].click(); await wait(300);
  out.liked = $("open-lib").textContent === "练习库 · 👍 1";

  const n = window.__calls.length;
  rowOf("冰火人").querySelector(".drill-tools button").click(); await idle(); await wait(300);
  out.swap_keeps_pictures = !window.__calls.slice(n).includes("detail") && lastPlan().querySelectorAll(".court-wrap svg").length === 5;

  btn("▶ 上课", lastPlan()).click(); await wait(200);
  const run = document.querySelector(".run");
  out.practice_mode = !!run && run.querySelector(".run-clock").textContent === "12:00";
  run.querySelector(".run-x").click();

  openLib(); out.library_lists_drill = $("lib-dlg").textContent.includes("头胸球"); $("lib-dlg").close();

  out.msgs_in_db = Object.values(JSON.parse(localStorage.getItem("mockdb"))).filter((c) => Object.values(c).some((m) => m.role)).reduce((a, c) => a + Object.keys(c).length, 0) === state.msgs.length;
  return out;
})();
