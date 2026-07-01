(function () {
  "use strict";

  var cfg = window.SupportFlowConfig || {};
  if (!cfg.apiKey) { console.error("SupportFlow: apiKey required"); return; }

  var BASE  = (cfg.baseUrl || "").replace(/\/$/, "");
  var KEY   = cfg.apiKey;
  var COLOR = cfg.primaryColor || "#6366f1";
  var POS   = cfg.position || "bottom-right";
  var THEME = cfg.theme || "light";
  var DARK  = THEME === "dark";
  var SIDE  = POS === "bottom-left" ? "left" : "right";

  // Theme tokens
  var BG    = DARK ? "#111827" : "#ffffff";
  var BG2   = DARK ? "#1f2937" : "#f9fafb";
  var BORD  = DARK ? "#374151" : "#e5e7eb";
  var TXT   = DARK ? "#f9fafb" : "#111827";
  var MUTED = DARK ? "#9ca3af" : "#6b7280";
  var C60   = COLOR + "99";
  var C20   = COLOR + "33";

  // State
  var convId        = null;
  var visitorId     = null;
  var isOpen        = false;
  var sessionData   = { flow: "INITIAL", step: "", collected: {} };
  var lastMsgAt     = null;
  var pollTimer     = null;
  var isBusy        = false;
  var companyName   = "Support";
  var chatStarted   = false;
  var unreadCount   = 0;
  var lastQR        = [];
  var renderedIds   = new Set(); // prevent duplicate messages from double-polling
  var pusherKey     = cfg.pusherKey     || null;
  var pusherCluster = cfg.pusherCluster || "ap2";
  var pusherChannel = null; // active Pusher subscription

  // Agent typing state (from Pusher)
  var agentIsTyping = false;
  var agentTypingTimer = null;

  // Pre-chat form
  var preChatEnabled   = false;
  var pcfRequireName   = false;
  var pcfRequireEmail  = false;
  var pcfRequirePhone  = false;
  var preChatSubmitted = false;

  // Load persisted data
  try {
    convId    = localStorage.getItem("sf_conv");
    visitorId = localStorage.getItem("sf_vid");
    var sd = localStorage.getItem("sf_session");
    if (sd) sessionData = JSON.parse(sd);
    var qr = localStorage.getItem("sf_qr");
    if (qr) lastQR = JSON.parse(qr);
  } catch(_){}

  if (!visitorId) {
    visitorId = "v_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem("sf_vid", visitorId); } catch(_){}
  }

  function saveSession(sd) {
    try { localStorage.setItem("sf_session", JSON.stringify(sd)); } catch(_){}
  }
  function saveQR(qr) {
    try { localStorage.setItem("sf_qr", JSON.stringify(qr)); } catch(_){}
  }

  // ── Audio ────────────────────────────────────────────────────────────────────
  function playBeep() {
    try {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain();
      o.connect(g); g.connect(ac.destination);
      o.type = "sine"; o.frequency.value = 1047;
      g.gain.setValueAtTime(0.07, ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.22);
      o.start(); o.stop(ac.currentTime + 0.22);
    } catch(_){}
  }

  // ── CSS ──────────────────────────────────────────────────────────────────────
  function injectCSS() {
    var s = document.createElement("style");
    s.textContent =
      // Reset
      "#sf-root,#sf-root *{box-sizing:border-box;margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}" +

      // Launcher
      "#sf-launch{position:fixed;" + SIDE + ":24px;bottom:24px;z-index:2147483646}" +
      "#sf-btn{position:relative;width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg," + COLOR + " 0%," + COLOR + "cc 100%);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px " + C60 + ";transition:transform .2s,box-shadow .2s}" +
      "#sf-btn:hover{transform:scale(1.1);box-shadow:0 12px 40px " + C60 + "}" +
      "#sf-btn svg{transition:all .2s}" +
      "#sf-btn.open svg.chat-icon{display:none}" +
      "#sf-btn.open svg.close-icon{display:block!important}" +
      "#sf-dot{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;background:#ef4444;border-radius:10px;border:2px solid white;display:none;font-size:11px;font-weight:700;color:white;padding:0 4px;line-height:16px;text-align:center;animation:sfP 2s infinite}" +
      "@keyframes sfP{0%,100%{box-shadow:0 0 0 0 #ef444466}60%{box-shadow:0 0 0 8px #ef444400}}" +

      // Window
      "#sf-win{position:fixed;" + SIDE + ":24px;bottom:100px;width:400px;height:620px;max-height:calc(100vh - 120px);display:flex;flex-direction:column;background:" + BG + ";border-radius:24px;box-shadow:0 20px 80px rgba(0,0,0,.22),0 4px 16px rgba(0,0,0,.1);z-index:2147483645;overflow:hidden;border:1px solid " + BORD + ";opacity:0;pointer-events:none;transform:translateY(24px) scale(.94);transition:opacity .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1)}" +
      "#sf-win.open{opacity:1;pointer-events:all;transform:none}" +

      // Header
      "#sf-head{background:linear-gradient(135deg," + COLOR + " 0%," + COLOR + "e0 100%);padding:18px 16px;display:flex;align-items:center;gap:12px;flex-shrink:0}" +
      "#sf-hav{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0}" +
      "#sf-hav svg{width:24px;height:24px;fill:white}" +
      "#sf-hi{flex:1;min-width:0}" +
      "#sf-hname{color:white;font-size:15px;font-weight:700;letter-spacing:.01em}" +
      "#sf-hsub{color:rgba(255,255,255,.8);font-size:12px;margin-top:3px;display:flex;align-items:center;gap:5px}" +
      "#sf-online{width:7px;height:7px;border-radius:50%;background:#4ade80;flex-shrink:0;animation:sfOn 2s infinite}" +
      "@keyframes sfOn{0%,100%{opacity:1;box-shadow:0 0 0 0 #4ade8066}50%{opacity:.7;box-shadow:0 0 0 5px #4ade8000}}" +
      "#sf-hx{background:rgba(255,255,255,.15);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s;color:white}" +
      "#sf-hx:hover{background:rgba(255,255,255,.28)}" +

      // Messages area
      "#sf-msgs{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:14px;background:" + BG2 + ";scroll-behavior:smooth}" +
      "#sf-msgs::-webkit-scrollbar{width:4px}" +
      "#sf-msgs::-webkit-scrollbar-thumb{background:" + BORD + ";border-radius:4px}" +

      // Date divider
      ".sf-date{text-align:center;font-size:11px;color:" + MUTED + ";padding:4px 12px;background:" + BORD + ";border-radius:20px;align-self:center;margin:4px 0}" +

      // Message rows
      ".sf-row{display:flex;align-items:flex-end;gap:8px;animation:sfFade .22s ease}" +
      "@keyframes sfFade{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}" +
      ".sf-row.you{flex-direction:row-reverse}" +

      // Avatars
      ".sf-av{width:28px;height:28px;border-radius:50%;background:" + C20 + ";display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:11px;font-weight:700;color:" + COLOR + ";border:1.5px solid " + BORD + "}" +
      ".sf-row.you .sf-av{background:" + COLOR + ";color:white;border:none}" +

      // Bubble wrapper
      ".sf-bwrap{display:flex;flex-direction:column;max-width:78%;gap:2px}" +
      ".sf-row.you .sf-bwrap{align-items:flex-end}" +

      // Sender label
      ".sf-lbl{font-size:10.5px;color:" + MUTED + ";font-weight:600;padding:0 4px}" +

      // Bubble
      ".sf-bub{padding:10px 14px;border-radius:18px;font-size:13.5px;line-height:1.65;word-break:break-word;white-space:pre-wrap;position:relative}" +
      ".sf-row.bot .sf-bub{background:" + BG + ";color:" + TXT + ";border:1px solid " + BORD + ";border-bottom-left-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.07)}" +
      ".sf-row.you .sf-bub{background:" + COLOR + ";color:white;border-bottom-right-radius:4px;box-shadow:0 2px 8px " + C60 + "}" +

      // Time
      ".sf-time{font-size:10px;color:" + MUTED + ";padding:0 4px;display:flex;align-items:center;gap:3px}" +

      // Typing
      ".sf-typing-wrap{display:flex;align-items:flex-end;gap:8px}" +
      ".sf-typing{background:" + BG + ";border:1px solid " + BORD + ";padding:12px 16px;border-radius:18px 18px 18px 4px;display:flex;gap:5px;align-items:center;box-shadow:0 1px 4px rgba(0,0,0,.07)}" +
      ".sf-typing span{width:7px;height:7px;background:" + MUTED + ";border-radius:50%;animation:sfDot 1.2s infinite ease-in-out}" +
      ".sf-typing span:nth-child(2){animation-delay:.2s}" +
      ".sf-typing span:nth-child(3){animation-delay:.4s}" +
      "@keyframes sfDot{0%,60%,100%{transform:translateY(0);opacity:.5}30%{transform:translateY(-7px);opacity:1}}" +

      // Quick replies
      "#sf-qr{padding:10px 14px 12px;background:" + BG + ";border-top:1px solid " + BORD + ";display:flex;flex-wrap:wrap;gap:7px;flex-shrink:0;max-height:200px;overflow-y:auto}" +
      "#sf-qr::-webkit-scrollbar{width:3px}" +
      "#sf-qr::-webkit-scrollbar-thumb{background:" + BORD + ";border-radius:3px}" +
      ".sf-qb{padding:8px 16px;border-radius:20px;border:1.5px solid " + COLOR + ";background:transparent;color:" + COLOR + ";font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;line-height:1.3;text-align:left}" +
      ".sf-qb:hover{background:" + COLOR + ";color:white;transform:translateY(-1px);box-shadow:0 4px 12px " + C60 + "}" +
      ".sf-qb.back{border-color:" + BORD + ";color:" + MUTED + ";font-size:12px}" +
      ".sf-qb.back:hover{background:" + BORD + ";color:" + TXT + ";transform:none;box-shadow:none}" +
      ".sf-qb.full{width:100%;border-radius:12px}" +

      // Input
      "#sf-foot{padding:10px 14px 14px;border-top:1px solid " + BORD + ";display:flex;align-items:flex-end;gap:8px;background:" + BG + ";flex-shrink:0}" +
      "#sf-inp{flex:1;border:1.5px solid " + BORD + ";border-radius:22px;padding:10px 16px;font-size:13.5px;outline:none;background:" + BG2 + ";color:" + TXT + ";resize:none;max-height:100px;line-height:1.5;transition:border-color .15s}" +
      "#sf-inp:focus{border-color:" + COLOR + ";box-shadow:0 0 0 3px " + C20 + "}" +
      "#sf-inp::placeholder{color:" + MUTED + "}" +
      "#sf-send{width:42px;height:42px;flex-shrink:0;border-radius:50%;background:" + COLOR + ";border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;box-shadow:0 4px 12px " + C60 + "}" +
      "#sf-send:hover:not(:disabled){transform:scale(1.1);box-shadow:0 6px 18px " + C60 + "}" +
      "#sf-send:disabled{opacity:.4;cursor:not-allowed;transform:none;box-shadow:none}" +

      // Pre-chat form
      "#sf-pcf-wrap{flex:1;display:flex;flex-direction:column;justify-content:center;padding:24px 20px;gap:14px;background:" + BG2 + "}" +
      "#sf-pcf-title{font-size:15px;font-weight:700;color:" + TXT + ";text-align:center;margin-bottom:4px}" +
      "#sf-pcf-sub{font-size:12px;color:" + MUTED + ";text-align:center;margin-bottom:8px}" +
      ".sf-pcf-field{display:flex;flex-direction:column;gap:5px}" +
      ".sf-pcf-label{font-size:12px;font-weight:600;color:" + TXT + "}" +
      ".sf-pcf-input{border:1.5px solid " + BORD + ";border-radius:12px;padding:10px 14px;font-size:13px;outline:none;background:" + BG + ";color:" + TXT + ";transition:border-color .15s}" +
      ".sf-pcf-input:focus{border-color:" + COLOR + ";box-shadow:0 0 0 3px " + C20 + "}" +
      "#sf-pcf-btn{margin-top:4px;background:" + COLOR + ";color:white;border:none;border-radius:14px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;transition:opacity .15s}" +
      "#sf-pcf-btn:hover{opacity:.88}" +

      // Powered by
      "#sf-pwr{text-align:center;font-size:10.5px;color:" + MUTED + ";padding:5px 0 6px;flex-shrink:0;background:" + BG + "}" +
      "#sf-pwr a{color:" + COLOR + ";text-decoration:none;font-weight:600}" +

      // Mobile
      "@media(max-width:440px){" +
        "#sf-win{left:0!important;right:0!important;bottom:0!important;width:100%!important;height:100%!important;max-height:100%!important;border-radius:0!important;border:none}" +
        "#sf-launch{" + SIDE + ":16px;bottom:16px}" +
      "}";
    document.head.appendChild(s);
  }

  // ── Build HTML ───────────────────────────────────────────────────────────────
  function buildWidget() {
    var root = document.createElement("div");
    root.id = "sf-root";
    root.innerHTML =
      '<div id="sf-launch">' +
        '<button id="sf-btn" aria-label="Open chat">' +
          '<svg class="chat-icon" width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>' +
          '<svg class="close-icon" style="display:none" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
        '</button>' +
        '<div id="sf-dot"></div>' +
      '</div>' +
      '<div id="sf-win" role="dialog" aria-label="Chat">' +
        '<div id="sf-head">' +
          '<div id="sf-hav"><svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg></div>' +
          '<div id="sf-hi">' +
            '<div id="sf-hname">Support</div>' +
            '<div id="sf-hsub"><span id="sf-online"></span>Online &bull; Replies instantly</div>' +
          '</div>' +
          '<button id="sf-hx" aria-label="Close">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="sf-pcf-wrap" style="display:none">' +
          '<p id="sf-pcf-title">Before we start…</p>' +
          '<p id="sf-pcf-sub">Please share a few details so we can help you better.</p>' +
          '<form id="sf-pcf" style="display:flex;flex-direction:column;gap:12px"></form>' +
        '</div>' +
        '<div id="sf-msgs"></div>' +
        '<div id="sf-qr" style="display:none"></div>' +
        '<div id="sf-foot">' +
          '<textarea id="sf-inp" rows="1" placeholder="Type a message…"></textarea>' +
          '<button id="sf-send" disabled>' +
            '<svg width="17" height="17" viewBox="0 0 24 24" fill="white"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
          '</button>' +
        '</div>' +
        '<div id="sf-pwr">Powered by <a href="https://supportflow.app" target="_blank">SupportFlow</a></div>' +
      '</div>';
    document.body.appendChild(root);

    document.getElementById("sf-btn").addEventListener("click", toggle);
    document.getElementById("sf-hx").addEventListener("click", toggle);
    document.getElementById("sf-send").addEventListener("click", sendText);

    var inp = document.getElementById("sf-inp");
    inp.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = Math.min(this.scrollHeight, 100) + "px";
      document.getElementById("sf-send").disabled = !this.value.trim();
    });
    inp.addEventListener("keydown", function(e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendText(); }
    });
  }

  // ── Toggle ───────────────────────────────────────────────────────────────────
  function toggle() {
    isOpen = !isOpen;
    var win = document.getElementById("sf-win");
    var btn = document.getElementById("sf-btn");
    win.classList.toggle("open", isOpen);
    btn.classList.toggle("open", isOpen);

    if (isOpen) {
      hideDot();
      unreadCount = 0;

      if (!chatStarted) {
        // Show pre-chat form if enabled and visitor data not yet collected
        if (preChatEnabled && !preChatSubmitted) {
          showPreChatForm();
        } else {
          startChatFlow();
        }
      } else {
        // Widget already started — just restart polling on re-open
        startPoll();
      }

      setTimeout(function() {
        var inp = document.getElementById("sf-inp");
        if (inp && inp.style.display !== "none") inp.focus();
      }, 300);
    } else {
      stopPoll();
    }
  }

  // ── Send ─────────────────────────────────────────────────────────────────────
  function sendText() {
    var inp = document.getElementById("sf-inp");
    var text = inp.value.trim();
    if (!text || isBusy) return;
    inp.value = "";
    inp.style.height = "auto";
    document.getElementById("sf-send").disabled = true;
    sendMessage(text);
  }

  function sendOption(text) {
    if (isBusy) return;
    sendMessage(text);
  }

  function sendMessage(text) {
    addBubble(text, "you");
    setOptions([], false);
    showTyping();
    isBusy = true;

    var snap = sessionData;
    callChatWithSession(text, snap).then(function(data) {
      hideTyping();
      isBusy = false;
      if (data) renderBotResponse(data);
    }).catch(function() {
      hideTyping();
      isBusy = false;
      addBubble("Something went wrong. Please try again.", "bot");
    });
  }

  var msgCount = 0;
  function renderBotResponse(data) {
    var msgs = data.messages || [];
    var delay = 0;
    msgs.forEach(function(msg, i) {
      setTimeout(function() {
        addBubble(msg, "bot");
        msgCount++;
        if (!isOpen) { unreadCount++; showDot(); }
        else playBeep();
        if (i === msgs.length - 1) {
          var qr = data.quickReplies || [];
          setOptions(qr, qr.length > 0);
          if (qr.length) saveQR(qr);
          // Show CSAT after 6+ message exchanges
          if (msgCount >= 6 && !csatShown) setTimeout(showCSAT, 800);
        }
      }, delay);
      delay += 420;
    });
    if (data.sessionData) {
      sessionData = data.sessionData;
      saveSession(sessionData);
      var col = sessionData.collected || {};
      if (col.name && col.phone) {
        try { localStorage.setItem("sf_visitor", JSON.stringify({ name: col.name, phone: col.phone })); } catch(_){}
      }
    }
  }

  // ── API ──────────────────────────────────────────────────────────────────────
  function callChat(msg) { return callChatWithSession(msg, sessionData); }

  function callChatWithSession(msg, sess) {
    return post("/api/widget/chat", {
      apiKey: KEY, conversationId: convId, visitorId: visitorId,
      message: msg, sessionData: sess,
    }).then(function(r) {
      if (!r.success) {
        if (r.error === "Invalid API key") showErr("Invalid API key. Please check your SupportFlow dashboard.");
        return null;
      }
      return r.data;
    }).catch(function() {
      showErr("Cannot connect to server at " + BASE);
      return null;
    });
  }

  function startConv() {
    var col = sessionData.collected || {};
    return post("/api/widget", {
      apiKey: KEY, action: "start_conversation",
      data: {
        visitorId: visitorId,
        visitorName: col.name || null,
        visitorPhone: col.phone || null,
        currentPage: window.location.href,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
      },
    }).then(function(r) {
      if (r && r.success && r.data) {
        convId = r.data.conversationId;
        try { localStorage.setItem("sf_conv", convId); } catch(_){}
        subscribeRealtime(convId); // start Pusher real-time for this conversation
      }
    }).catch(function(){});
  }

  // Returns true if any messages were loaded
  function loadHistory() {
    if (!convId) return Promise.resolve(false);
    return post("/api/widget", {
      apiKey: KEY, action: "get_messages",
      data: { conversationId: convId, after: null },
    }).then(function(r) {
      if (r && r.success && r.data && r.data.length) {
        r.data.forEach(function(m) {
          if (renderedIds.has(m._id)) return;
          renderedIds.add(m._id);
          var side = (m.senderType === "AGENT" || m.senderType === "BOT") ? "bot" : "you";
          var label = (m.senderType === "AGENT" && m.senderId && m.senderId.name) ? m.senderId.name : null;
          addBubble(m.content, side, m.createdAt, label);
          if (m.createdAt) lastMsgAt = m.createdAt;
        });
        return true;
      }
      return false;
    }).catch(function() { return false; });
  }

  function pollNew() {
    if (!convId || !isOpen) return;
    post("/api/widget", {
      apiKey: KEY, action: "get_messages",
      data: { conversationId: convId, after: lastMsgAt },
    }).then(function(r) {
      if (r && r.success && r.data && r.data.length) {
        r.data.filter(function(m) { return m.senderType === "AGENT"; }).forEach(function(m) {
          if (renderedIds.has(m._id)) return; // skip already-rendered
          renderedIds.add(m._id);
          var label = (m.senderId && m.senderId.name) ? m.senderId.name : "Agent";
          addBubble(m.content, "bot", m.createdAt, label);
          if (m.createdAt) lastMsgAt = m.createdAt;
          playBeep();
          if (!isOpen) { unreadCount++; showDot(); }
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

  function startPoll() {
    if (pusherChannel) return; // Pusher handles real-time — no polling needed
    stopPoll();
    pollTimer = setInterval(pollNew, 5000);
  }
  function stopPoll()  { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

  // ── Pusher real-time subscription ────────────────────────────────────────────
  function loadPusherScript(cb) {
    if (window.Pusher) { cb(window.Pusher); return; }
    var s = document.createElement("script");
    s.src = "https://js.pusher.com/8.2.0/pusher.min.js";
    s.onload  = function() { cb(window.Pusher); };
    s.onerror = function() { cb(null); }; // fall back to polling silently
    document.head.appendChild(s);
  }

  function subscribeRealtime(cId) {
    if (!pusherKey || !cId || pusherChannel) return;
    loadPusherScript(function(Pusher) {
      if (!Pusher) return; // graceful fallback — polling still runs
      try {
        var client = new Pusher(pusherKey, { cluster: pusherCluster });
        pusherChannel = client.subscribe("chat-" + cId);
        pusherChannel.bind("message", function(msg) {
          if (!msg || !msg.id || renderedIds.has(msg.id)) return;
          var type = msg.senderType;
          if (type !== "AGENT" && type !== "BOT") return;
          renderedIds.add(msg.id);
          // Hide agent typing indicator when message arrives
          if (agentIsTyping) { agentIsTyping = false; if (!isBusy) hideTyping(); }
          var label = (type === "AGENT" && msg.senderName) ? msg.senderName : null;
          addBubble(msg.content, "bot", msg.createdAt, label);
          if (msg.createdAt) lastMsgAt = msg.createdAt;
          if (!isOpen) { unreadCount++; showDot(); }
          else playBeep();
        });
        pusherChannel.bind("typing", function(data) {
          if (data && data.isTyping) {
            agentIsTyping = true;
            clearTimeout(agentTypingTimer);
            if (!isBusy) showTyping();
            // Auto-hide after 5s as a safety net
            agentTypingTimer = setTimeout(function() {
              agentIsTyping = false;
              if (!isBusy) hideTyping();
            }, 5000);
          } else {
            agentIsTyping = false;
            clearTimeout(agentTypingTimer);
            if (!isBusy) hideTyping();
          }
        });
        stopPoll(); // Pusher is now the source of truth
      } catch(e) {} // any Pusher init error → polling continues
    });
  }

  // ── UI helpers ────────────────────────────────────────────────────────────────
  function addBubble(text, side, ts, senderLabel) {
    var msgs = document.getElementById("sf-msgs");
    var isBot = side === "bot";

    var row = document.createElement("div");
    row.className = "sf-row " + side;

    // Avatar
    var av = document.createElement("div");
    av.className = "sf-av";
    av.textContent = isBot ? (senderLabel ? senderLabel[0].toUpperCase() : "A") : "Me";
    row.appendChild(av);

    // Bubble wrapper
    var wrap = document.createElement("div");
    wrap.className = "sf-bwrap";

    // Sender label (only for agent replies, not bot)
    if (isBot && senderLabel) {
      var lbl = document.createElement("div");
      lbl.className = "sf-lbl";
      lbl.textContent = senderLabel;
      wrap.appendChild(lbl);
    }

    var bub = document.createElement("div");
    bub.className = "sf-bub";
    bub.textContent = text;
    wrap.appendChild(bub);

    var timeEl = document.createElement("div");
    timeEl.className = "sf-time";
    timeEl.textContent = fmtTime(ts || new Date());
    if (!isBot) {
      var tick = document.createElement("span");
      tick.style.cssText = "font-size:12px;color:" + COLOR + "99";
      tick.textContent = "✓✓";
      timeEl.appendChild(tick);
    }
    wrap.appendChild(timeEl);
    row.appendChild(wrap);

    msgs.appendChild(row);
    msgs.scrollTop = msgs.scrollHeight;
    return row;
  }

  function setOptions(opts, show) {
    var el = document.getElementById("sf-qr");
    if (!el) return;
    el.innerHTML = "";
    if (!show || !opts || !opts.length) { el.style.display = "none"; return; }
    el.style.display = "flex";

    var avgLen = opts.reduce(function(a, o) { return a + o.length; }, 0) / opts.length;
    var useFullWidth = avgLen > 20 || opts.length > 5;

    opts.forEach(function(opt) {
      var isBack = /Main Menu|Go Back/i.test(opt);
      var btn = document.createElement("button");
      btn.className = "sf-qb" + (isBack ? " back" : "") + (useFullWidth ? " full" : "");
      btn.textContent = opt;
      btn.addEventListener("click", function() { sendOption(opt); });
      el.appendChild(btn);
    });
    el.scrollTop = 0;
  }

  function showTyping() {
    if (document.getElementById("sf-typing-row")) return;
    var wrap = document.createElement("div");
    wrap.id = "sf-typing-row";
    wrap.className = "sf-typing-wrap";
    var av = document.createElement("div");
    av.className = "sf-av";
    av.textContent = "A";
    wrap.appendChild(av);
    var t = document.createElement("div");
    t.className = "sf-typing";
    t.innerHTML = "<span></span><span></span><span></span>";
    wrap.appendChild(t);
    var msgs = document.getElementById("sf-msgs");
    msgs.appendChild(wrap);
    msgs.scrollTop = 999999;
  }

  function hideTyping() {
    var el = document.getElementById("sf-typing-row");
    if (el) el.remove();
  }

  function showDot() {
    var d = document.getElementById("sf-dot");
    if (!d) return;
    d.style.display = "block";
    d.textContent = unreadCount > 9 ? "9+" : (unreadCount > 0 ? String(unreadCount) : "");
  }

  function hideDot() {
    var d = document.getElementById("sf-dot");
    if (d) { d.style.display = "none"; d.textContent = ""; }
  }

  function showErr(msg) {
    hideTyping();
    isBusy = false;
    addBubble("⚠️ " + msg, "bot");
  }

  function fmtTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ── Fetch company info ────────────────────────────────────────────────────────
  function fetchCompany() {
    fetch(BASE + "/api/widget?key=" + encodeURIComponent(KEY))
      .then(function(r) { return r.json(); })
      .then(function(d) {
        if (!d.success || !d.data) return;
        if (d.data.name) {
          companyName = d.data.name;
          var el = document.getElementById("sf-hname");
          if (el) el.textContent = companyName;
        }
        // Pick up Pusher config from server
        if (d.data.pusherKey) {
          pusherKey     = d.data.pusherKey;
          pusherCluster = d.data.pusherCluster || "ap2";
          if (convId && !pusherChannel) subscribeRealtime(convId);
        }
        // Pre-chat form settings
        if (d.data.preChatForm) {
          preChatEnabled  = true;
          pcfRequireName  = !!d.data.requireName;
          pcfRequireEmail = !!d.data.requireEmail;
          pcfRequirePhone = !!d.data.requirePhone;
          // Check if visitor data already collected
          try {
            var saved = localStorage.getItem("sf_visitor");
            if (saved) {
              var vd = JSON.parse(saved);
              if (vd && (vd.name || vd.email)) preChatSubmitted = true;
            }
          } catch(_){}
          // Build the form DOM after settings load
          buildPreChatForm();
        }
        // Proactive trigger: auto-open widget after N seconds
        var delay = parseInt(d.data.proactiveDelay || "0", 10);
        if (delay > 0) {
          setTimeout(function() {
            if (!isOpen && !chatStarted) toggle();
          }, delay * 1000);
        }
      }).catch(function(){});
  }

  // ── Pre-chat form ─────────────────────────────────────────────────────────────
  function buildPreChatForm() {
    var form = document.getElementById("sf-pcf");
    if (!form) return;
    form.innerHTML = "";

    var fields = [];
    if (pcfRequireName  || preChatEnabled) fields.push({ id: "pcf-name",  label: "Your Name",  type: "text",  placeholder: "John Doe",         key: "name"  });
    if (pcfRequireEmail)                    fields.push({ id: "pcf-email", label: "Email",       type: "email", placeholder: "you@example.com",  key: "email" });
    if (pcfRequirePhone)                    fields.push({ id: "pcf-phone", label: "Phone",       type: "tel",   placeholder: "+1 555 000 0000",  key: "phone" });
    // Default: always show name if nothing specific is required
    if (!fields.length) fields.push({ id: "pcf-name", label: "Your Name", type: "text", placeholder: "John Doe", key: "name" });

    fields.forEach(function(f) {
      var wrap = document.createElement("div");
      wrap.className = "sf-pcf-field";
      var lbl = document.createElement("label");
      lbl.className = "sf-pcf-label";
      lbl.textContent = f.label;
      lbl.setAttribute("for", f.id);
      var inp = document.createElement("input");
      inp.className = "sf-pcf-input";
      inp.id = f.id;
      inp.type = f.type;
      inp.placeholder = f.placeholder;
      inp.setAttribute("data-key", f.key);
      wrap.appendChild(lbl);
      wrap.appendChild(inp);
      form.appendChild(wrap);
    });

    var btn = document.createElement("button");
    btn.id = "sf-pcf-btn";
    btn.type = "submit";
    btn.textContent = "Start Chat →";
    form.appendChild(btn);

    form.addEventListener("submit", function(e) {
      e.preventDefault();
      var collected = {};
      form.querySelectorAll("[data-key]").forEach(function(el) {
        var v = el.value.trim();
        if (v) collected[el.getAttribute("data-key")] = v;
      });
      // Save visitor data
      try { localStorage.setItem("sf_visitor", JSON.stringify(collected)); } catch(_){}
      if (sessionData.collected) {
        Object.assign(sessionData.collected, collected);
      } else {
        sessionData.collected = collected;
      }
      saveSession(sessionData);
      preChatSubmitted = true;
      // Hide form, show chat
      document.getElementById("sf-pcf-wrap").style.display = "none";
      document.getElementById("sf-msgs").style.display = "flex";
      document.getElementById("sf-foot").style.display = "flex";
      // Now start the conversation
      startChatFlow();
    });
  }

  function showPreChatForm() {
    var pcf = document.getElementById("sf-pcf-wrap");
    var msgs = document.getElementById("sf-msgs");
    var foot = document.getElementById("sf-foot");
    if (pcf) pcf.style.display = "flex";
    if (msgs) msgs.style.display = "none";
    if (foot) foot.style.display = "none";
  }

  function startChatFlow() {
    if (chatStarted) { startPoll(); return; }
    chatStarted = true;
    showTyping();
    isBusy = true;
    var initWithSession = function() {
      callChat("__INIT__").then(function(data) {
        isBusy = false;
        hideTyping();
        if (data) renderBotResponse(data);
        startPoll();
      }).catch(function() { isBusy = false; hideTyping(); startPoll(); });
    };
    if (!convId) {
      startConv().then(initWithSession);
    } else {
      loadHistory().then(function(hasHistory) {
        if (!hasHistory) {
          convId = null;
          try { localStorage.removeItem("sf_conv"); } catch(_){}
          sessionData = { flow: "INITIAL", step: "", collected: sessionData.collected || {} };
          saveSession(sessionData);
          startConv().then(initWithSession);
        } else {
          isBusy = false;
          hideTyping();
          if (lastQR && lastQR.length) setOptions(lastQR, true);
          startPoll();
        }
      });
    }
  }

  // ── CSAT Rating ──────────────────────────────────────────────────────────────
  var csatShown = false;
  function showCSAT() {
    if (csatShown || !convId) return;
    csatShown = true;
    var msgs = document.getElementById("sf-msgs");
    if (!msgs) return;

    var wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 12px;background:" + BG + ";border:1px solid " + BORD + ";border-radius:16px;margin-top:8px";

    var lbl = document.createElement("p");
    lbl.textContent = "How was your experience?";
    lbl.style.cssText = "font-size:13px;font-weight:600;color:" + TXT + ";margin:0";
    wrap.appendChild(lbl);

    var stars = document.createElement("div");
    stars.style.cssText = "display:flex;gap:6px";
    var selected = 0;

    [1,2,3,4,5].forEach(function(n) {
      var s = document.createElement("button");
      s.textContent = "★";
      s.setAttribute("data-n", String(n));
      s.style.cssText = "font-size:28px;background:none;border:none;cursor:pointer;color:#d1d5db;transition:color .15s;padding:0 2px";
      s.addEventListener("mouseenter", function() {
        stars.querySelectorAll("button").forEach(function(b) {
          b.style.color = Number(b.getAttribute("data-n")) <= n ? COLOR : "#d1d5db";
        });
      });
      s.addEventListener("mouseleave", function() {
        stars.querySelectorAll("button").forEach(function(b) {
          b.style.color = Number(b.getAttribute("data-n")) <= selected ? COLOR : "#d1d5db";
        });
      });
      s.addEventListener("click", function() {
        selected = n;
        stars.querySelectorAll("button").forEach(function(b) {
          b.style.color = Number(b.getAttribute("data-n")) <= n ? COLOR : "#d1d5db";
        });
        submitCSAT(n, wrap);
      });
      stars.appendChild(s);
    });
    wrap.appendChild(stars);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  function submitCSAT(rating, wrap) {
    post("/api/widget/rate", { conversationId: convId, rating: rating }).catch(function(){});
    wrap.innerHTML = "<p style=\"font-size:13px;color:" + MUTED + ";text-align:center;padding:4px 0\">Thanks for your feedback! ⭐</p>";
  }

  // ── Boot ──────────────────────────────────────────────────────────────────────
  function boot() { injectCSS(); buildWidget(); fetchCompany(); }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
