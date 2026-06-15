(function () {
  "use strict";

  var cfg = window.SupportFlowConfig || {};
  if (!cfg.apiKey) { console.error("SupportFlow: apiKey required"); return; }

  var BASE   = (cfg.baseUrl || "").replace(/\/$/, "");
  var KEY    = cfg.apiKey;
  var COLOR  = cfg.primaryColor || "#6366f1";
  var POS    = cfg.position || "bottom-right";
  var THEME  = cfg.theme || "light";
  var WMSG   = cfg.welcomeMessage || "Hi! How can we help you today? 👋";
  var DARK   = THEME === "dark";
  var SIDE   = POS === "bottom-left" ? "left" : "right";
  var OSIDE  = POS === "bottom-left" ? "right" : "left";

  var BG   = DARK ? "#1f2937" : "#fff";
  var BG2  = DARK ? "#111827" : "#f9fafb";
  var BORD = DARK ? "#374151" : "#e5e7eb";
  var TXT  = DARK ? "#f9fafb" : "#111827";
  var MUTED = DARK ? "#9ca3af" : "#6b7280";

  var convId        = null;
  var visitorId     = null;
  var isOpen        = false;
  var sessionData   = { flow: "INITIAL", step: "", collected: {} };
  var lastMsgAt     = null;
  var pollTimer     = null;
  var isBusy        = false;
  var companyName   = "Support";
  var visitorInfo   = null; // { name, phone } — captured on first open
  var chatStarted   = false;

  try { convId = localStorage.getItem("sf_conv"); visitorId = localStorage.getItem("sf_vid"); } catch(_){}
  try { var vi = localStorage.getItem("sf_visitor"); if (vi) visitorInfo = JSON.parse(vi); } catch(_){}
  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem("sf_vid", visitorId); } catch(_){}
  }

  // ── Soft beep (Web Audio API) ────────────────────────────────────────────
  function playBeep() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    } catch(_){}
  }

  // ── CSS ──────────────────────────────────────────────────────────────────
  function injectCSS() {
    var el = document.createElement("style");
    el.textContent =
      "#sf-root *{box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0}" +
      /* launch button */
      "#sf-launch{position:fixed;" + SIDE + ":20px;bottom:20px;z-index:2147483646}" +
      "#sf-btn{width:56px;height:56px;border-radius:50%;background:" + COLOR + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 24px rgba(0,0,0,.28);transition:transform .2s}" +
      "#sf-btn:hover{transform:scale(1.09)}" +
      "#sf-btn svg{width:26px;height:26px;fill:white;transition:transform .22s}" +
      "#sf-dot{position:absolute;top:-3px;" + SIDE + ":-3px;width:16px;height:16px;background:#ef4444;border-radius:50%;display:none;border:2px solid white;animation:sfPulse 2s infinite}" +
      "@keyframes sfPulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}" +
      /* chat window */
      "#sf-win{position:fixed;" + SIDE + ":20px;bottom:88px;width:380px;height:580px;max-height:calc(100vh - 110px);background:" + BG + ";border-radius:18px;box-shadow:0 12px 48px rgba(0,0,0,.2);display:flex;flex-direction:column;z-index:2147483645;overflow:hidden;border:1px solid " + BORD + ";opacity:0;pointer-events:none;transform:translateY(16px) scale(.96);transition:opacity .24s,transform .24s}" +
      "#sf-win.open{opacity:1;pointer-events:all;transform:translateY(0) scale(1)}" +
      /* header */
      "#sf-head{background:" + COLOR + ";padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0}" +
      "#sf-hav{width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,.18);display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      "#sf-hav svg{width:20px;height:20px;fill:white}" +
      "#sf-hi{flex:1;min-width:0}" +
      "#sf-hname{color:white;font-weight:700;font-size:14.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#sf-hsub{color:rgba(255,255,255,.78);font-size:11.5px;margin-top:2px;display:flex;align-items:center;gap:5px}" +
      "#sf-online{width:7px;height:7px;border-radius:50%;background:#4ade80;display:inline-block;flex-shrink:0}" +
      "#sf-hx{background:none;border:none;color:rgba(255,255,255,.8);cursor:pointer;padding:5px;border-radius:6px;line-height:0;flex-shrink:0}" +
      "#sf-hx:hover{color:white;background:rgba(255,255,255,.15)}" +
      /* visitor form */
      "#sf-form{flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:28px 24px;background:" + BG2 + ";gap:18px}" +
      "#sf-form h3{font-size:17px;font-weight:700;color:" + TXT + ";text-align:center;line-height:1.4}" +
      "#sf-form p{font-size:13px;color:" + MUTED + ";text-align:center;line-height:1.5}" +
      ".sf-fi{width:100%;display:flex;flex-direction:column;gap:5px}" +
      ".sf-fi label{font-size:12px;font-weight:600;color:" + TXT + "}" +
      ".sf-fi input{width:100%;border:1.5px solid " + BORD + ";border-radius:10px;padding:10px 14px;font-size:13.5px;color:" + TXT + ";background:" + BG + ";outline:none;transition:border-color .15s}" +
      ".sf-fi input:focus{border-color:" + COLOR + "}" +
      "#sf-fstart{width:100%;padding:12px;background:" + COLOR + ";color:white;border:none;border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .2s}" +
      "#sf-fstart:hover{opacity:.9}" +
      "#sf-ferr{color:#ef4444;font-size:12px;text-align:center;display:none}" +
      /* messages */
      "#sf-msgs{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;background:" + BG2 + ";scroll-behavior:smooth}" +
      "#sf-msgs::-webkit-scrollbar{width:4px}" +
      "#sf-msgs::-webkit-scrollbar-thumb{background:" + BORD + ";border-radius:4px}" +
      ".sf-row{display:flex;flex-direction:column}" +
      ".sf-row.bot{align-items:flex-start}" +
      ".sf-row.you{align-items:flex-end}" +
      ".sf-bub{max-width:85%;padding:10px 14px;border-radius:18px;font-size:13.5px;line-height:1.6;word-break:break-word;white-space:pre-wrap}" +
      ".bot .sf-bub{background:" + BG + ";color:" + TXT + ";border:1px solid " + BORD + ";border-radius:18px 18px 18px 4px;box-shadow:0 1px 4px rgba(0,0,0,.06)}" +
      ".you .sf-bub{background:" + COLOR + ";color:white;border-radius:18px 18px 4px 18px}" +
      ".sf-time{font-size:10px;color:" + MUTED + ";margin-top:3px;padding:0 3px;display:flex;align-items:center;gap:3px}" +
      ".bot .sf-time{text-align:left;justify-content:flex-start}" +
      ".you .sf-time{text-align:right;justify-content:flex-end}" +
      ".sf-tick{font-size:11px;color:rgba(255,255,255,.6)}" +
      /* typing indicator */
      "#sf-typing-row{display:flex;align-items:center}" +
      "#sf-typing{background:" + BG + ";border:1px solid " + BORD + ";padding:11px 16px;border-radius:18px 18px 18px 4px;display:flex;gap:4px;align-items:center}" +
      "#sf-typing span{width:7px;height:7px;background:#94a3b8;border-radius:50%;animation:sfb 1.1s infinite}" +
      "#sf-typing span:nth-child(2){animation-delay:.18s}" +
      "#sf-typing span:nth-child(3){animation-delay:.36s}" +
      "@keyframes sfb{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-7px)}}" +
      /* quick reply buttons */
      "#sf-opts{padding:10px 14px 12px;background:" + BG2 + ";border-top:1px solid " + BORD + ";display:flex;flex-direction:column;gap:6px;flex-shrink:0;max-height:210px;overflow-y:auto}" +
      "#sf-opts::-webkit-scrollbar{width:3px}" +
      "#sf-opts::-webkit-scrollbar-thumb{background:" + BORD + ";border-radius:3px}" +
      ".sf-opt{width:100%;padding:10px 14px;border-radius:10px;border:1.5px solid " + COLOR + ";background:transparent;color:" + COLOR + ";font-size:13.5px;font-weight:500;cursor:pointer;text-align:left;transition:background .15s,color .15s;line-height:1.3}" +
      ".sf-opt:hover{background:" + COLOR + ";color:white}" +
      ".sf-opt.back{border-color:" + BORD + ";color:" + MUTED + ";font-size:12.5px}" +
      ".sf-opt.back:hover{background:" + BORD + ";color:" + TXT + "}" +
      /* footer input */
      "#sf-foot{padding:10px 12px;border-top:1px solid " + BORD + ";display:flex;gap:8px;align-items:flex-end;background:" + BG + ";flex-shrink:0}" +
      "#sf-inp{flex:1;border:1.5px solid " + BORD + ";border-radius:22px;padding:10px 16px;font-size:13px;outline:none;background:" + BG2 + ";color:" + TXT + ";resize:none;max-height:90px;line-height:1.4;transition:border-color .15s}" +
      "#sf-inp:focus{border-color:" + COLOR + "}" +
      "#sf-inp::placeholder{color:" + MUTED + "}" +
      "#sf-send{width:38px;height:38px;flex-shrink:0;border-radius:50%;background:" + COLOR + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .2s,transform .15s}" +
      "#sf-send:hover{opacity:.9;transform:scale(1.07)}" +
      "#sf-send svg{width:16px;height:16px;fill:white}" +
      "#sf-pwr{text-align:center;font-size:10px;color:" + MUTED + ";padding:4px 0 6px;flex-shrink:0}" +
      "#sf-pwr a{color:" + COLOR + ";text-decoration:none}" +
      /* mobile responsive */
      "@media(max-width:440px){" +
        "#sf-win{" + SIDE + ":0!important;right:0!important;left:0!important;bottom:0!important;width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important;border:none}" +
        "#sf-launch{" + SIDE + ":14px;bottom:14px}" +
      "}";
    document.head.appendChild(el);
  }

  // ── Build widget HTML ────────────────────────────────────────────────────
  function buildWidget() {
    var root = document.createElement("div");
    root.id = "sf-root";
    root.innerHTML =
      '<div id="sf-launch">' +
        '<button id="sf-btn" aria-label="Open chat">' +
          '<svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
        '</button>' +
        '<div id="sf-dot"></div>' +
      '</div>' +
      '<div id="sf-win" role="dialog" aria-label="Chat window">' +
        '<div id="sf-head">' +
          '<div id="sf-hav"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></div>' +
          '<div id="sf-hi">' +
            '<div id="sf-hname">Support</div>' +
            '<div id="sf-hsub"><span id="sf-online"></span> We reply in minutes</div>' +
          '</div>' +
          '<button id="sf-hx" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' +
        '</div>' +
        /* Visitor identity form (shown before chat starts if no saved info) */
        '<div id="sf-form" style="display:none">' +
          '<h3>👋 Welcome!</h3>' +
          '<p>Please introduce yourself so we can assist you better.</p>' +
          '<div class="sf-fi"><label>Your Name *</label><input id="sf-fn" type="text" placeholder="John Doe" autocomplete="name"></div>' +
          '<div class="sf-fi"><label>Phone / Email</label><input id="sf-fp" type="text" placeholder="+91 98765 43210 or email@example.com" autocomplete="tel"></div>' +
          '<div id="sf-ferr"></div>' +
          '<button id="sf-fstart">Start Chatting →</button>' +
        '</div>' +
        '<div id="sf-msgs" style="display:none"></div>' +
        '<div id="sf-opts" style="display:none"></div>' +
        '<div id="sf-foot" style="display:none">' +
          '<textarea id="sf-inp" rows="1" placeholder="Type a message…" aria-label="Chat input"></textarea>' +
          '<button id="sf-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg></button>' +
        '</div>' +
        '<div id="sf-pwr">Powered by <a href="https://supportflow.app" target="_blank">SupportFlow</a></div>' +
      '</div>';
    document.body.appendChild(root);

    document.getElementById("sf-btn").addEventListener("click", toggle);
    document.getElementById("sf-hx").addEventListener("click", toggle);
    document.getElementById("sf-send").addEventListener("click", sendText);
    document.getElementById("sf-fstart").addEventListener("click", submitForm);

    var inp = document.getElementById("sf-inp");
    inp.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
    });
    inp.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 90) + "px";
    });

    // Allow Enter in form fields to submit
    document.getElementById("sf-fp").addEventListener("keydown", function(e) {
      if (e.key === "Enter") { e.preventDefault(); submitForm(); }
    });
  }

  // ── Toggle chat open/close ───────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    document.getElementById("sf-win").classList.toggle("open", isOpen);
    if (isOpen) {
      hideDot();
      if (!chatStarted) {
        if (visitorInfo) {
          // We already have visitor info — go straight to chat
          showChat();
          if (!document.getElementById("sf-msgs").hasChildNodes()) {
            addBubble("Hi " + visitorInfo.name + "! 👋 " + WMSG.replace("Hi! ", ""), "bot");
            callChat("__INIT__");
          }
        } else {
          showForm();
        }
      }
      startPoll();
    } else {
      stopPoll();
    }
  }

  // ── Visitor identity form ─────────────────────────────────────────────────
  function showForm() {
    document.getElementById("sf-form").style.display = "flex";
    document.getElementById("sf-msgs").style.display = "none";
    document.getElementById("sf-opts").style.display = "none";
    document.getElementById("sf-foot").style.display = "none";
    setTimeout(function() { document.getElementById("sf-fn").focus(); }, 100);
  }

  function showChat() {
    chatStarted = true;
    document.getElementById("sf-form").style.display = "none";
    document.getElementById("sf-msgs").style.display = "flex";
    document.getElementById("sf-foot").style.display = "flex";
    setTimeout(function() { document.getElementById("sf-inp").focus(); }, 100);
  }

  function submitForm() {
    var name  = (document.getElementById("sf-fn").value || "").trim();
    var phone = (document.getElementById("sf-fp").value || "").trim();
    var err   = document.getElementById("sf-ferr");

    if (!name) {
      err.textContent = "Please enter your name to continue.";
      err.style.display = "block";
      document.getElementById("sf-fn").focus();
      return;
    }
    err.style.display = "none";
    visitorInfo = { name: name, phone: phone };
    try { localStorage.setItem("sf_visitor", JSON.stringify(visitorInfo)); } catch(_){}

    showChat();
    addBubble("Hi " + name + "! 👋 " + WMSG.replace("Hi! ", ""), "bot");
    // Inject collected info into sessionData so flows have name/phone pre-filled
    sessionData = { flow: "INITIAL", step: "", collected: { name: name, phone: phone } };
    callChat("__INIT__");
  }

  // ── Send typed message ────────────────────────────────────────────────────
  function sendText() {
    var inp = document.getElementById("sf-inp");
    var text = inp.value.trim();
    if (!text || isBusy) return;
    inp.value = "";
    inp.style.height = "auto";
    sendMessage(text);
  }

  function sendOption(text) {
    if (isBusy) return;
    sendMessage(text);
  }

  // ── Core send ─────────────────────────────────────────────────────────────
  function sendMessage(text) {
    if (text !== "__INIT__") {
      addBubble(text, "you");
    }
    setOptions([], false);
    showTyping();
    isBusy = true;

    var doCall = function() {
      callChat(text).then(function(data) {
        hideTyping();
        isBusy = false;
        if (!data) return;
        var msgs = data.messages || [];
        var delay = 0;
        msgs.forEach(function(msg, i) {
          setTimeout(function() {
            addBubble(msg, "bot");
            playBeep();
            if (i === msgs.length - 1) {
              setOptions(data.quickReplies && data.quickReplies.length ? data.quickReplies : [], !!(data.quickReplies && data.quickReplies.length));
            }
          }, delay);
          delay += 550;
        });
        if (data.sessionData) sessionData = data.sessionData;
      }).catch(function() {
        hideTyping();
        isBusy = false;
        addBubble("Something went wrong. Please try again.", "bot");
      });
    };

    if (!convId) {
      startConv().then(doCall);
    } else {
      doCall();
    }
  }

  // ── API calls ─────────────────────────────────────────────────────────────
  function callChat(message) {
    return post("/api/widget/chat", {
      apiKey: KEY,
      conversationId: convId,
      visitorId: visitorId,
      message: message,
      sessionData: sessionData,
    }).then(function(r) { return r.success ? r.data : null; });
  }

  function startConv() {
    return post("/api/widget", {
      apiKey: KEY,
      action: "start_conversation",
      data: {
        visitorId: visitorId,
        visitorName: visitorInfo ? visitorInfo.name : null,
        visitorPhone: visitorInfo ? visitorInfo.phone : null,
        currentPage: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      },
    }).then(function(r) {
      if (r.success && r.data) {
        convId = r.data.conversationId;
        try { localStorage.setItem("sf_conv", convId); } catch(_){}
      }
    }).catch(function(){});
  }

  function pollNew() {
    if (!convId || !isOpen) return;
    post("/api/widget", {
      apiKey: KEY,
      action: "get_messages",
      data: { conversationId: convId, after: lastMsgAt },
    }).then(function(r) {
      if (r.success && r.data && r.data.length) {
        r.data.filter(function(m) { return m.senderType === "AGENT"; }).forEach(function(m) {
          addBubble("💬 " + (m.senderName || "Agent") + ": " + m.content, "bot", m.createdAt);
          lastMsgAt = m.createdAt;
          playBeep();
          if (!isOpen) showDot();
        });
      }
    }).catch(function(){});
  }

  function post(path, data) {
    return fetch(BASE + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(function(r) { return r.json(); });
  }

  function startPoll() { stopPoll(); pollTimer = setInterval(pollNew, 5000); }
  function stopPoll()  { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  // ── UI helpers ────────────────────────────────────────────────────────────
  function addBubble(text, side, ts) {
    var msgs = document.getElementById("sf-msgs");
    var row  = document.createElement("div");
    row.className = "sf-row " + (side === "bot" ? "bot" : "you");

    var bub  = document.createElement("div");
    bub.className = "sf-bub";
    bub.textContent = text;

    var timeEl = document.createElement("div");
    timeEl.className = "sf-time";
    timeEl.textContent = fmtTime(ts || new Date());

    if (side === "you") {
      var tick = document.createElement("span");
      tick.className = "sf-tick";
      tick.textContent = " ✓";
      timeEl.appendChild(tick);
    }

    row.appendChild(bub);
    row.appendChild(timeEl);
    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  function setOptions(opts, show) {
    var el = document.getElementById("sf-opts");
    if (!el) return;
    el.innerHTML = "";
    if (!show || !opts || !opts.length) { el.style.display = "none"; return; }
    el.style.display = "flex";
    opts.forEach(function(opt) {
      var btn = document.createElement("button");
      btn.className = "sf-opt" + (opt.includes("Main Menu") || opt.includes("Go Back") ? " back" : "");
      btn.textContent = opt;
      btn.addEventListener("click", function() { sendOption(opt); });
      el.appendChild(btn);
    });
    el.scrollTop = 0;
  }

  function showTyping() {
    if (document.getElementById("sf-typing-row")) return;
    var row = document.createElement("div");
    row.id  = "sf-typing-row";
    row.className = "sf-row bot";
    row.innerHTML = '<div id="sf-typing"><span></span><span></span><span></span></div>';
    document.getElementById("sf-msgs").appendChild(row);
    document.getElementById("sf-msgs").scrollTop = 99999;
  }

  function hideTyping() { var el = document.getElementById("sf-typing-row"); if (el) el.remove(); }
  function showDot()    { var d = document.getElementById("sf-dot"); if (d) d.style.display = "block"; }
  function hideDot()    { var d = document.getElementById("sf-dot"); if (d) d.style.display = "none"; }
  function fmtTime(ts)  { return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

  // ── Fetch company name ───────────────────────────────────────────────────
  function fetchCompany() {
    fetch(BASE + "/api/widget?key=" + KEY)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (d.success && d.data && d.data.name) {
          companyName = d.data.name;
          var el = document.getElementById("sf-hname");
          if (el) el.textContent = companyName;
        }
      }).catch(function(){});
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function boot() { injectCSS(); buildWidget(); fetchCompany(); }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
