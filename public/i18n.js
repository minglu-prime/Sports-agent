/* English interface for the U12 planner.
 * The page is written in Chinese. In English mode this layer translates interface text as it appears in the DOM
 * (fixed texts from a dictionary, texts with values from patterns). The page logic stays untouched, and in Chinese
 * mode nothing here runs. Text written by the coach or the model matches no entry and is shown as it is. */
(function (root) {
  "use strict";

  const PHASE = { "热身": "Warm-up", "灵活与弹跳": "Mobility & jumping", "神经激活": "Neural activation", "技术": "Technique", "比赛": "Game" };
  const GOAL = { "协调": "coordination", "反应": "reaction", "速度": "speed", "技术": "technique", "体能": "fitness", "比赛理解": "game sense" };
  const phase = (s) => PHASE[s] || s;

  const EXACT = {
    ...PHASE, // part headings; a single goal word that is also a part name reads as the heading
    // page frame
    "U12 备课助手": "U12 Session Planner", "篮球备课助手": "Basketball Session Planner", "历史对话": "History", "＋ 新对话": "＋ New chat", "新对话": "New chat",
    "练习库": "Drill library", "展开或收起历史对话": "Show or hide history", "修改上课条件": "Change session settings", "取消引用": "Stop quoting",
    "上课条件": "Session settings", "说说今天想练什么…": "What to train today?", "消息": "Message", "发送": "Send", "停止": "Stop",
    "时长（分钟）": "Length (minutes)", "人数": "Players", "篮筐": "Baskets", "比赛至少（分钟）": "Game at least (minutes)", "器材": "Equipment",
    "练习内容的语言": "Language of the drills", "界面语言": "Interface language", "Deutsch（给德国助教看）": "Deutsch (for German assistant coaches)",
    "天冷：先把核心体温提上来": "Cold hall: raise body temperature first", "完成": "Done", "未命名": "Untitled", "之前的对话": "Earlier chat",
    "还没有对话。发第一条消息就会出现在这里。": "No chats yet. Your first message starts one.", "请先登录。": "Please sign in first.", "请先登录": "Please sign in first",
    "我": "Me", "助": "AI", "教": "C",
    "你好，我是备课助手。直接说今天想练什么，比如：\n「这周练快攻，长传和2打1，孩子最近注意力差，多点比赛。」\n我会按 热身 → 灵活与弹跳 → 神经激活 → 技术 → 比赛 排好一节课。不满意就直接说哪里要改。":
      "Hi, I'm your session planner. Tell me what you want to train today, for example:\n\"Fast breaks this week: long passes and 2-on-1. The kids lose focus quickly, so more games.\"\nI'll plan a session as Warm-up → Mobility & jumping → Neural activation → Technique → Game. If something doesn't fit, just say what to change.",
    // quick replies (sent to the model as the coach's message)
    "换一个神经激活游戏": "Swap the neural activation game", "热身再好玩一点": "Make the warm-up more fun", "技术段更多对抗": "More competition in the technique part",
    "比赛加一条快攻规则": "Add a fast-break rule to the game", "同样重点，出一节新课": "Same focus, a new session",
    "这周练快攻：长传和2打1": "Fast breaks this week: long passes and 2-on-1", "练接球投篮，多点比赛": "Catch and shoot, with more games",
    "练防守脚步，孩子注意力差": "Defensive footwork; the kids lose focus quickly",
    // plan card
    "训练计划": "Session plan", "✓ 已上课": "✓ Held", "这版计划没过检查：": "This plan did not pass the checks:", "时间分配": "Time split",
    "练什么": "Trains", "场地": "Setup", "玩法": "Rules", "计分": "Scoring", "口令": "Cue", "简单一点": "Easier", "难一点": "Harder",
    "基于这个改": "Edit this plan", "标记已上课": "Mark as held", "这条消息没保存成功，不能标记": "This message was not saved, so it can't be marked",
    "复制文字": "Copy text", "已复制": "Copied", "已选中，请手动复制": "Selected: please copy it yourself", "给整节课画图": "Draw all pictures", "▶ 上课": "▶ Practice",
    "换一个": "Swap", "👍 孩子喜欢": "👍 Kids liked it", "👎 不再用": "👎 Don't use again",
    // court pictures
    "跑动": "run", "传球": "pass", "运球": "dribble", "投篮": "shot", "进攻/练习者": "offence / player", "防守": "defence", "球": "ball", "标志桶": "cone", "教练": "coach",
    "全场示意图": "Full-court diagram", "半场示意图": "Half-court diagram", "● 蓝=进攻": "● blue = offence", "■ 红=防守": "■ red = defence", "▲ 标志桶": "▲ cone",
    "正在画这个练习的场地图…": "Drawing this drill…", "画场地图": "Draw the picture", "重新画图": "Draw again", "按这次的说明重画": "Redraw for this version",
    "这张图来自练习库，练习有改动的话可以重画。": "This picture comes from the drill library. Redraw it if the drill changed.",
    "▶ 按步骤演示": "▶ Play step by step", "图里有些内容没画出来：": "Some things could not be drawn:", "详细步骤和常见错误": "Steps and common mistakes",
    "步骤": "Steps", "常见错误": "Common mistakes", "回答不是有效的图解格式": "The answer is not a valid picture description",
    "这次回答里没有场地图": "This answer has no court diagram", "场地图里没有任何球员或标志": "The court diagram has no players or markers",
    // practice mode
    "上课模式": "Practice mode", "这个浏览器不能保持亮屏，锁屏后计时照常走。": "This browser can't keep the screen on. The timer keeps running when the screen locks.",
    "✓ 已经标记过": "✓ Already marked", "这节课上完了": "Session finished",
    "标记已上课后，回到计划给每个练习点 👍 或 👎，下次排课会参考。": "After marking it as held, go back to the plan and rate each drill 👍 or 👎. The next plan will use your ratings.",
    "关闭": "Close", "退出上课模式": "Leave practice mode", "这是最后一个": "This is the last drill", "◀ 上一个": "◀ Back", "⏸ 暂停": "⏸ Pause",
    "▶ 继续": "▶ Resume", "▶ 开始": "▶ Start", "下一个 ▶": "Next ▶", "结束": "Finish",
    // library
    "排进下节课": "Use in next session", "移出练习库": "Remove from library", "恢复（不再排除）": "Restore (stop blocking it)",
    "还没有评价过的练习。上完课点「标记已上课」，再给每个练习点 👍 或 👎，就会出现在这里。": "No rated drills yet. After a session, tap \"Mark as held\" and rate each drill 👍 or 👎. They will appear here.",
    "关闭练习库": "Close the drill library", "👎 不再排的": "👎 Blocked drills",
    // settings problems
    "时长要在45到150分钟之间": "The length must be between 45 and 150 minutes", "人数至少2人": "At least 2 players", "至少1个篮筐": "At least 1 basket",
    "比赛至少20分钟": "The game must be at least 20 minutes", "比赛时间太长，其他环节不够排": "The game is too long to fit the other parts",
    // notices and errors
    "聊天记录加载超时，刷新页面再试。": "Loading the chat timed out. Reload the page and try again.", "聊天记录还在加载，稍等再发。": "The chat is still loading. Wait a moment, then send.",
    "对方正在输入…": "Typing…", "计划好了。": "The plan is ready.", "（没有收到回答）": "(No answer received)",
    "登录已过期，请重新登录": "Your sign-in has expired. Please sign in again", "这个账号不能生成计划": "This account can't generate plans",
    "用量到上限了，稍后再试": "Usage limit reached, try again later", "回答格式不对，再发一次": "The answer had the wrong format. Send it again",
    "内容太长，删掉一些聊天或换个短点的说法": "The request is too long. Shorten it or start a new chat", "生成服务暂时连不上，再发一次": "The generation service can't be reached. Send it again",
    "请求失败": "Request failed", "现在不能生成计划：请先登录。": "Plans can't be generated: please sign in first.", "聊天记录不会保存：请先登录。": "The chat won't be saved: please sign in first.",
    // sign-in and data layer
    "登录": "Sign in", "发送验证码": "Send code", "邮箱": "Email", "正在发送…": "Sending…", "正在登录…": "Signing in…", "输入验证码": "Enter the code", "验证码": "Code",
    "输入你被邀请的邮箱，我们会发一个数字验证码。": "Enter the email you were invited with. We'll send you a numeric code.",
    "计划由 DeepSeek 生成（服务器在中国），请不要输入孩子的全名。": "Plans are generated by DeepSeek (servers in China). Please don't type children's full names.",
    "邮件里的数字": "The digits from the email", "换个邮箱 / 重新发送": "Other email / send again", "没有拿到登录状态": "no session was returned",
    "这个邮箱还没有账号。管理员要在 Supabase → Authentication → Users → Add user → Create new user 添加它，并勾选 Auto Confirm User。":
      "This email has no account yet. The admin has to add it in Supabase → Authentication → Users → Add user → Create new user, with Auto Confirm User ticked.",
    "网络连不上，请检查网络后再试。": "No connection. Check your network and try again.", "发送太频繁，请过一分钟再试。": "Too many requests. Wait a minute and try again.",
    "验证码不对或已过期，请重新输入或重新发送。": "The code is wrong or has expired. Enter it again or send a new one.",
    "数据里有 undefined 字段": "the data has an undefined field", "读取失败": "Reading failed", "保存失败": "Saving failed", "删除失败": "Deleting failed",
    "已停止": "Stopped", "回答中断了，再发一次": "The answer was cut off. Send it again",
    // server messages
    "今天的用量到上限了，明天再试": "Today's usage limit is reached, try again tomorrow", "用量记录读取失败，稍后再试": "Usage could not be read, try again later",
    "登录服务暂时连不上，稍后再试": "The sign-in service can't be reached, try again later", "请求格式不对": "The request has the wrong format",
    "请求里没有内容": "The request is empty", "内容太长": "The request is too long", "DeepSeek 余额不足": "The DeepSeek balance is used up",
    "服务器的 DeepSeek 密钥无效": "The server's DeepSeek key is invalid", "DeepSeek 现在太忙，稍后再试": "DeepSeek is busy, try again later",
    "DeepSeek 返回了空白回答": "DeepSeek returned an empty answer", "DeepSeek 的回答不是有效的 JSON": "DeepSeek's answer is not valid JSON",
  };

  /** Texts with values: [pattern, builder]. `t` translates an embedded piece; quoted pieces are the coach's or the model's content. */
  const PATTERNS = [
    // validator
    [/^五段顺序不对，应为：(.+)。$/, (m) => `The five parts are out of order. Expected: ${m[1].split(" → ").map(phase).join(" → ")}.`],
    [/^回复里没有完整的计划（缺少 phasen）。$/, () => "The answer has no complete plan (phasen is missing)."],
    [/^「(.+)」没有练习。$/, (m) => `"${phase(m[1])}" has no drills.`],
    [/^「(.+)」第 (\d+) 个练习没有有效分钟数。$/, (m) => `"${phase(m[1])}": drill ${m[2]} has no valid minutes.`],
    [/^「(.+)」第 (\d+) 个练习缺少「(.+)」。$/, (m) => `"${phase(m[1])}": drill ${m[2]} is missing "${m[3]}".`],
    [/^练习「(.+)」重复出现。$/, (m) => `Drill "${m[1]}" appears twice.`],
    [/^「(.+)」孩子不喜欢（教练点过👎），换一个。$/, (m) => `"${m[1]}" was rated 👎 by the coach. Replace it.`],
    [/^「(.+)」标了 (.+) 分钟，练习加起来是 (\d+) 分钟。$/, (m) => `"${phase(m[1])}" says ${m[2]} min, but its drills add up to ${m[3]} min.`],
    [/^总时长 (\d+) 分钟，要求 (\d+) 分钟。$/, (m) => `Total is ${m[1]} min, but ${m[2]} min are required.`],
    [/^比赛只有 (\d+) 分钟，至少要 (\d+) 分钟。$/, (m) => `The game is only ${m[1]} min. It needs at least ${m[2]} min.`],
    [/^天冷，热身只有 (\d+) 分钟，至少要 10 分钟。$/, (m) => `Cold hall: the warm-up is only ${m[1]} min. It needs at least 10 min.`],
    [/^神经激活「(.+)」最近 (\d+) 节课已经上过。$/, (m) => `Neural activation "${m[1]}" was used in the last ${m[2]} sessions.`],
    // settings line, plan line
    [/^(\d+)分钟 · (\d+)人 · (\d+)筐 · 比赛≥(\d+)′( · 天冷)?( · [A-Za-z]+)?  ✎$/, (m) => `${m[1]} min · ${m[2]} players · ${m[3]} baskets · game ≥${m[4]}′${m[5] ? " · cold hall" : ""}${m[6] || ""}  ✎`],
    [/^(\d+)分钟 · (\d+)人 · (\d+)筐( · 天冷)?$/, (m) => `${m[1]} min · ${m[2]} players · ${m[3]} baskets${m[4] ? " · cold hall" : ""}`],
    [/^(.+) (\d+)分钟$/, (m) => `${phase(m[1])} ${m[2]} min`],
    [/^器材：([\s\S]*)$/, (m) => `Equipment: ${m[1]}`],
    [/^[协调反应速度技术体能比赛理解、]+$/, (m) => m[0].split("、").map((g) => GOAL[g] || g).join(", ")],
    // court pictures
    [/^动作 (\d+)（(.+)）起点和终点太近，没画箭头$/, (m, t) => `Action ${m[1]} (${t(m[2])}): start and end are too close, so no arrow was drawn`],
    [/^动作 (\d+)：找不到球员「(.+)」$/, (m) => `Action ${m[1]}: player "${m[2]}" was not found`],
    [/^动作 (\d+) 类型不对$/, (m) => `Action ${m[1]} has an unknown type`],
    [/^第 (\d+) 个元素类型不对$/, (m) => `Marker ${m[1]} has an unknown type`],
    [/^(.+)的位置「(.+)」看不懂$/, (m, t) => `The position "${m[2]}" of ${t(m[1])} was not understood`],
    [/^动作 (\d+)（(.+)）$/, (m) => `action ${m[1]} (${m[2]})`],
    [/^→ (.+)$/, (m, t) => `→ ${t(m[1])}`],
    [/^图没存进聊天记录（(.*)），刷新后要重新画。$/, (m) => `The picture was not saved to the chat (${m[1]}). It must be drawn again after a reload.`],
    [/^(画图失败|出错了)：(.+?)（代码：([^，）]*)(?:，([\s\S]*))?）$/, (m, t) => `${m[1] === "画图失败" ? "Drawing failed" : "Something went wrong"}: ${t(m[2])} (code: ${m[3]}${m[4] ? ", " + t(m[4]) : ""})`],
    // messages the page writes into the composer
    [/^把「(.+)」换成另一个(.+)练习，(\d+)分钟不变，其他练习不动。$/, (m) => `Replace "${m[1]}" with another ${phase(m[2]).toLowerCase()} drill. Keep it at ${m[3]} minutes and leave the other drills as they are.`],
    [/^下节课用上「(.+)」$/, (m) => `Use "${m[1]}" in the next session`],
    // small states
    [/^没存上（(.*)）$/, (m) => `Not saved (${m[1]})`],
    [/^没删掉（(.*)）$/, (m) => `Not removed (${m[1]})`],
    [/^记录失败（(.*)）$/, (m) => `Not recorded (${m[1]})`],
    [/^没能保持亮屏（(.*)），锁屏后计时照常走。$/, (m) => `The screen could not be kept on (${m[1]}). The timer keeps running when the screen locks.`],
    [/^(\d+)\/(\d+) · 剩 $/, (m) => `${m[1]}/${m[2]} · left `],
    [/^计分：([\s\S]*)$/, (m) => `Scoring: ${m[1]}`],
    [/^下一个：(.+)（(\d+)′）$/, (m) => `Next: ${m[1]} (${m[2]}′)`],
    [/^引用：([\s\S]*)$/, (m, t) => `Quoting: ${t(m[1])}`],
    [/^练习库 · 👍 (\d+)$/, (m) => `Drill library · 👍 ${m[1]}`],
    [/^(.+) · 👍$/, (m) => `${phase(m[1])} · 👍`],
    [/^最近(\d+)节上过，之后再排$/, (m) => `Used in the last ${m[1]} sessions; use it later`],
    // notices
    [/^这条消息没存上（(.*)），刷新后会消失。$/, (m) => `This message was not saved (${m[1]}). It will be gone after a reload.`],
    [/^「已上课」记录不完整（(.*)），刷新后再点一次。$/, (m) => `The "held" mark is incomplete (${m[1]}). Reload and tap it again.`],
    [/^已记录，但避免重复的列表没刷新（(.*)），刷新页面即可。$/, (m) => `Recorded, but the no-repeat list was not refreshed (${m[1]}). Reload the page.`],
    [/^聊天记录加载失败（(.*)）。可以继续用，但不会避开重复练习。$/, (m) => `The chat could not be loaded (${m[1]}). You can go on, but repeated drills won't be avoided.`],
    [/^历史对话加载失败（(.*)）。可以继续用，但不会避开重复练习。$/, (m) => `Held sessions could not be loaded (${m[1]}). You can go on, but repeated drills won't be avoided.`],
    [/^历史对话列表加载失败（(.*)）。$/, (m) => `The chat list could not be loaded (${m[1]}).`],
    [/^练习库加载失败（(.*)）。这次排课不会参考👍和👎。$/, (m) => `The drill library could not be loaded (${m[1]}). This plan won't use your 👍 and 👎.`],
    [/^上课条件有问题：(.+)。点左下角 \+ 修改。$/, (m, t) => `The session settings have a problem: ${m[1].split("；").map(t).join("; ")}. Tap + at the bottom left to change them.`],
    [/^对话没能保存（(.*)），这次聊天刷新后会丢失。$/, (m) => `The chat could not be saved (${m[1]}). It will be lost after a reload.`],
    [/^对方正在输入…（(\d+)字）$/, (m) => `Typing… (${m[1]} characters)`],
    [/^检查发现 (\d+) 处问题，正在修正…$/, (m) => `The checks found ${m[1]} problems. Fixing them…`],
    [/^页面启动失败：([\s\S]*)$/, (m, t) => `The page failed to start: ${t(m[1])}`],
    // sign-in and data layer
    [/^验证码已发送到 (.+)，几分钟内有效。$/, (m) => `A code was sent to ${m[1]}. It is valid for a few minutes.`],
    [/^退出登录（(.*)）$/, (m) => `Sign out (${m[1]})`],
    [/^退出失败：([\s\S]*)$/, (m) => `Sign-out failed: ${m[1]}`],
    [/^出错了：([\s\S]*)$/, (m, t) => `Something went wrong: ${t(m[1])}`],
    [/^(读取失败|保存失败|删除失败)（([\s\S]*)）$/, (m, t) => `${t(m[1])} (${m[2]})`],
    [/^没有这条记录：(.*)$/, (m) => `No such record: ${m[1]}`],
    [/^连不上服务器（(.*)）$/, (m) => `The server can't be reached (${m[1]})`],
    [/^服务器错误 (\d+)$/, (m) => `Server error ${m[1]}`],
    [/^服务器回复格式不对（(.*)）$/, (m) => `The server's answer has the wrong format (${m[1]})`],
    [/^服务器没配置 (.+)$/, (m) => `The server is missing the setting ${m[1]}`],
    [/^配置读取失败（(.*)）$/, (m) => `The configuration could not be loaded (${m[1]})`],
    [/^登录组件加载失败，请检查网络后刷新（(.*)）$/, (m) => `The sign-in component could not be loaded. Check your network and reload (${m[1]})`],
  ];

  const CJK = /[一-鿿]/;
  /** Chinese interface text → English. Unknown text (the coach's or the model's content) comes back unchanged. */
  function translate(s) {
    if (typeof s !== "string" || !CJK.test(s)) return s;
    const lead = s.match(/^\s*/)[0], trail = s.match(/\s*$/)[0];
    const core = lead.length + trail.length < s.length ? s.slice(lead.length, s.length - trail.length) : s;
    const hit = EXACT[s] !== undefined ? EXACT[s] : EXACT[core] !== undefined ? lead + EXACT[core] + trail : undefined;
    if (hit !== undefined) return hit;
    if (core.endsWith("。") && EXACT[core.slice(0, -1)] !== undefined) return lead + EXACT[core.slice(0, -1)] + "." + trail;
    for (const [re, build] of PATTERNS) {
      const m = s.match(re) || (core !== s && core.match(re));
      if (m) return (m.input === s ? "" : lead) + build(m, translate) + (m.input === s ? "" : trail);
    }
    return s;
  }

  /** Stored choice wins. A coach who already used the page stays Chinese. New visitors follow their browser. */
  function pickLang(stored, returning, nav) {
    if (stored === "zh" || stored === "en") return stored;
    if (returning) return "zh";
    return /^zh\b/i.test(nav || "") ? "zh" : "en";
  }

  const api = { translate, pickLang, lang: "zh", t: (s) => s, setLang() {} };
  root.U12I18n = api;
  if (!root.document) return; // tests

  const store = (k) => { try { return root.localStorage.getItem(k); } catch (e) { console.warn("language not read", e); return null; } };
  api.lang = pickLang(store("u12-lang"), store("u12-settings") !== null || store("u12-thread") !== null, root.navigator.language);
  api.t = (s) => (api.lang === "en" ? translate(s) : s);
  api.setLang = (lang) => {
    try { root.localStorage.setItem("u12-lang", lang); } catch (e) { console.warn("language not stored", e); }
    root.location.reload();
  };
  if (api.lang !== "en") return;

  const doc = root.document;
  doc.documentElement.lang = "en";
  doc.title = translate(doc.title);
  const ATTRS = ["aria-label", "placeholder", "title"];
  /** The coach's own messages are never translated. */
  const own = (node) => { const e = node.nodeType === 1 ? node : node.parentElement; return !!(e && e.closest && e.closest(".msg.out .bubble")); };
  const fixText = (n) => { if (own(n)) return; const v = translate(n.nodeValue); if (v !== n.nodeValue) n.nodeValue = v; };
  const fixAttrs = (e) => { for (const a of ATTRS) { const v = e.getAttribute && e.getAttribute(a); if (v) { const w = translate(v); if (w !== v) e.setAttribute(a, w); } } };
  const fixTree = (node) => {
    if (node.nodeType === 3) { fixText(node); return; }
    if (node.nodeType !== 1) return;
    fixAttrs(node);
    const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { if (n.nodeType === 3) fixText(n); else fixAttrs(n); }
  };
  fixTree(doc.body);
  // English defaults for a first visit: equipment text, and drills written in English
  if (store("u12-settings") === null) {
    const material = doc.getElementById("f-material"), content = doc.getElementById("f-sprache");
    if (material) material.value = "12 balls, 20 cones, 2 sets of bibs";
    if (content && content.querySelector('option[value="en"]')) content.value = "en";
  }
  new MutationObserver((records) => {
    for (const r of records) {
      if (r.type === "characterData") fixText(r.target);
      else if (r.type === "attributes") fixAttrs(r.target);
      else r.addedNodes.forEach(fixTree);
    }
  }).observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
})(typeof window !== "undefined" ? window : globalThis);
