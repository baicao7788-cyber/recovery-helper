(() => {
  'use strict';

  const KEY = 'rh_stand_v1';
  const TOTAL_DAYS = 30;
  const DAY_MS = 86400000;
  const MIN_MS = 60000;

  // ---------- storage ----------
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d) return Object.assign({ settings: {}, stands: {} }, d);
    } catch (e) { /* fall through */ }
    const db = { settings: {}, stands: {} };
    try {
      const old = JSON.parse(localStorage.getItem('rh_v1'));
      if (old && old.settings && old.settings.surgeryDate) db.settings.surgeryDate = old.settings.surgeryDate;
    } catch (e) { /* ignore */ }
    return db;
  }
  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));
  const S = () => db.settings;

  // ---------- time ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY_MS);
  const today = () => ymd(new Date());
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const toHm = m => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const dayN = s => diffDays(s, S().surgeryDate);

  const cfg = () => ({
    wake: S().wake || '08:00',
    sleep: S().sleep || '22:00',
    interval: +S().interval || 60,
  });

  // reminder times between waking up and going to bed
  function slots() {
    const { wake, sleep, interval } = cfg();
    const out = [];
    for (let t = toMin(wake) + interval; t <= toMin(sleep) - 30; t += interval) out.push(t);
    return out;
  }

  // ---------- phases ----------
  const PHASES = [
    { from: 1, to: 3, name: '刚出院 · 第 1–3 天', act: '扶着慢慢站起来，在屋里走 3–5 分钟', short: '屋里走 3–5 分钟',
      extra: '躺着的时候，每小时做 10 次踝泵：脚尖用力勾向自己停 3 秒，再用力往下绷 3 秒。能防腿上长血栓。' },
    { from: 4, to: 7, name: '第 1 周后半', act: '在屋里或楼下走 5–10 分钟', short: '走 5–10 分钟',
      extra: '走完不累可以多走几分钟，累了就停，别硬撑。' },
    { from: 8, to: 14, name: '第 2 周', act: '起来走 10 分钟左右', short: '走 10 分钟左右',
      extra: '另外上午、下午各散步一次，每次 15 分钟。仍然不提重物。' },
    { from: 15, to: TOTAL_DAYS, name: '第 3–4 周', act: '站起来活动 3–5 分钟，伸展一下', short: '站起来活动 3–5 分钟',
      extra: '坐着工作别超过一小时。每天再散步 20–30 分钟。' },
  ];
  function phaseOf(n) {
    if (n > TOTAL_DAYS) return { name: '满一个月', act: '按复查时医生的意见逐步加量', extra: '' };
    return PHASES.find(p => Math.max(1, n) <= p.to);
  }

  // ---------- stands ----------
  const standsOn = d => db.stands[d] || [];
  function lastStand() {
    const days = Object.keys(db.stands).sort();
    for (let i = days.length - 1; i >= 0; i--) {
      const a = db.stands[days[i]];
      if (a && a.length) return a[a.length - 1];
    }
    return null;
  }
  function slotState(t, list, interval, now, isToday) {
    const half = interval / 2;
    const hit = list.some(ts => {
      const d = new Date(ts);
      const m = d.getHours() * 60 + d.getMinutes();
      return m >= t - half && m < t + half;
    });
    if (hit) return 'done';
    if (!isToday) return 'miss';
    if (now >= t - half && now < t + half) return 'now';
    return now >= t + half ? 'miss' : '';
  }

  // ---------- ICS ----------
  const icsEscape = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  function fold(line) {
    const out = [];
    let cur = '', n = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (n + b > 73) { out.push(cur); cur = ' '; n = 1; }
      cur += ch; n += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function buildIcs(startDate, url) {
    const s = S();
    const startN = Math.max(1, dayN(startDate));
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//recovery-helper//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:起来走走'];
    let uid = 0;
    PHASES.forEach(p => {
      const from = Math.max(p.from, startN);
      if (from > p.to) return;
      const date = addDays(s.surgeryDate, from).replace(/-/g, '');
      slots().forEach(t => {
        uid++;
        const title = '起来走走 · ' + p.short;
        L.push('BEGIN:VEVENT', `UID:stand-${s.surgeryDate}-${uid}@recovery-helper`, 'DTSTAMP:' + stamp,
          `DTSTART:${date}T${toHm(t).replace(':', '')}00`, `DTEND:${date}T${toHm(t + 5).replace(':', '')}00`);
        if (p.to - from > 0) L.push(`RRULE:FREQ=DAILY;COUNT=${p.to - from + 1}`);
        L.push(fold('SUMMARY:' + icsEscape(title)));
        L.push(fold('DESCRIPTION:' + icsEscape(`${p.act}。${p.extra}${url ? `\n走完点一下：${url}` : ''}`)));
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + icsEscape(title)), 'TRIGGER:-PT0M', 'END:VALARM', 'END:VEVENT');
      });
    });
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  function downloadIcs() {
    const start = dayN(today()) < 1 ? addDays(S().surgeryDate, 1) : today();
    const text = buildIcs(start, location.href.split('#')[0].split('?')[0]);
    const file = new File([text], 'qilai-zouzou.ics', { type: 'text/calendar' });
    const href = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = href; a.download = file.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 4000);
    S().icsDone = true; save();
    toast('已生成提醒，按提示添加到日历');
  }

  // ---------- UI ----------
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  const openModal = html => { $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); };
  const closeModal = () => $('#modal').classList.add('hidden');
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && S().surgeryDate) closeModal(); });

  function render() {
    if (!S().surgeryDate) { view.innerHTML = ''; $('#daybadge').textContent = ''; openSettings(true); return; }
    const d = today();
    const n = dayN(d);
    const ph = phaseOf(n);
    const { wake, sleep, interval } = cfg();
    $('#daybadge').textContent = `术后第 ${Math.max(0, n)} 天 · ${ph.name}`;

    const now = nowMin();
    const awake = now >= toMin(wake) && now < toMin(sleep);
    const list = standsOn(d);
    const last = lastStand();
    const since = last ? Math.floor((Date.now() - last) / MIN_MS) : null;
    const due = awake && (since === null || since >= interval);

    let big, sinceText;
    if (!awake) { big = '休息时间'; sinceText = '好好睡，醒了再起来走'; }
    else if (since === null || since > 24 * 60) { big = '该起来了'; sinceText = '今天还没起来走过'; }
    else {
      sinceText = '距离上次起来';
      big = since < 60 ? `${since} 分钟` : `${Math.floor(since / 60)} 小时 ${since % 60} 分`;
    }

    const sl = slots();
    const states = sl.map(t => slotState(t, list, interval, now, true));
    const goal = sl.length;
    const pct = goal ? Math.min(100, Math.round(list.length / goal * 100)) : 0;

    view.innerHTML = `
      <section class="card hero ${due ? 'due' : 'ok'}">
        <div class="since">${esc(sinceText)}</div>
        <div class="big">${esc(big)}</div>
        <div class="action">${due ? '现在：' : '下一次：'}${esc(ph.act)}</div>
        <button class="stand-btn" data-act="stand">我起来走了<small>走完点一下</small></button>
        ${list.length ? '<div><button class="undo" data-act="undo">点错了，撤销上一次</button></div>' : ''}
      </section>

      <section class="card">
        <div class="count">今天起来了 <b>${list.length}</b> 次 · 目标 ${goal} 次</div>
        <div class="progress"><i style="width:${pct}%"></i></div>
        <div class="slots">${sl.map((t, i) => `<div class="slot ${states[i]}">${toHm(t)}</div>`).join('')}</div>
        <div class="muted" style="margin-top:8px">绿色是这个钟点起来过。漏了没关系，下一个钟点补上就行。</div>
      </section>

      ${ph.extra ? `<section class="card"><h2>这几天还要做</h2><div>${esc(ph.extra)}</div></section>` : ''}

      <section class="card">
        <h2>怎么起身不疼</h2>
        <ol class="steps">
          <li>先侧过身，两个膝盖弯起来</li>
          <li>用手肘和手撑着床，慢慢坐起来，两条腿一起放到床边</li>
          <li>坐着停 30 秒，不头晕再站；头几次站起来，身边最好有人</li>
          <li>起身或咳嗽时，用小枕头轻轻按住肚子</li>
          <li>走的时候头晕眼花，马上坐下</li>
        </ol>
      </section>

      ${S().icsDone ? '' : `<section class="card">
        <h2>还没设置手机提醒</h2>
        <div class="muted">导入一次，醒着的时候每 ${interval} 分钟手机就会响一次。</div>
        <button class="btn" data-act="icsGuide">设置提醒</button>
      </section>`}

      <div class="warn-line">一条腿肿痛、突然胸闷气短、头晕到站不住：马上去医院或打 120。</div>
    `;
  }

  function openSettings(first) {
    const s = S();
    const { wake, sleep, interval } = cfg();
    openModal(`
      <h2>${first ? '先填三项' : '设置'}</h2>
      ${first ? '<div class="muted">只存在这台手机里。</div>' : ''}
      <label class="f">手术日期</label>
      <input class="in" id="sDate" type="date" value="${esc(s.surgeryDate || '')}">
      <div class="row">
        <div><label class="f">一般几点起床</label><input class="in" id="sWake" type="time" value="${wake}"></div>
        <div><label class="f">一般几点睡</label><input class="in" id="sSleep" type="time" value="${sleep}"></div>
      </div>
      <label class="f">多久提醒一次</label>
      <select class="in" id="sInt">
        ${[45, 60, 90].map(v => `<option value="${v}" ${v === interval ? 'selected' : ''}>每 ${v} 分钟${v === 60 ? '（推荐）' : ''}</option>`).join('')}
      </select>
      <button class="btn" data-act="save">${first ? '开始' : '保存'}</button>
      ${first ? '' : `
        <div class="muted" style="margin-top:14px">改了起床、睡觉时间或间隔，要重新导入一次提醒。导入前先在日历里删掉旧的「起来走走」。</div>
        <button class="btn ghost" data-act="icsGuide">重新设置提醒</button>
        <button class="btn ghost" data-act="close">关闭</button>`}
    `);
  }

  function openIcsGuide() {
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    openModal(`
      <h2>设置手机提醒</h2>
      <div>点下面的按钮，会生成接下来每天的“起来走走”提醒，走多久会随恢复天数自动变。</div>
      <ul class="plain">
        <li>弹出“下载”时点<b>下载</b>，再点地址栏旁的下载图标打开这个文件</li>
        <li>出现日历页面后点<b>全部添加</b></li>
        <li>之后到点手机就会响，不用打开这个网页</li>
      </ul>
      ${standalone ? '<div class="muted" style="margin-top:8px">如果在主屏幕图标里点了没反应，请用 Safari 打开这个网址再点一次。</div>' : ''}
      <button class="btn" data-act="ics">生成并导入提醒</button>
      <a class="btn ghost" href="reminders.ics" data-act="icsStatic">上面没反应？导入通用版（8 点到 22 点，每小时）</a>
      <button class="btn ghost" data-act="close">先不导入</button>
      <div class="muted" style="margin-top:12px">想像 App 一样打开：Safari 底部点“分享”→“添加到主屏幕”。</div>
    `);
  }

  function saveSettings() {
    const date = $('#sDate').value;
    if (!date) { toast('请先填手术日期'); return; }
    const wake = $('#sWake').value || '08:00';
    const sleep = $('#sSleep').value || '22:00';
    if (toMin(sleep) - toMin(wake) < 120) { toast('睡觉时间要比起床晚至少两小时'); return; }
    const first = !S().surgeryDate;
    const changed = !first && (S().wake !== wake || S().sleep !== sleep || +S().interval !== +$('#sInt').value || S().surgeryDate !== date);
    Object.assign(db.settings, { surgeryDate: date, wake, sleep, interval: +$('#sInt').value });
    if (changed) db.settings.icsDone = false;
    save();
    closeModal();
    render();
    if (first) openIcsGuide();
    else toast(changed ? '已保存，记得重新导入提醒' : '已保存');
  }

  $('#btnSettings').addEventListener('click', () => S().surgeryDate && openSettings(false));

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    switch (t.dataset.act) {
      case 'stand': {
        const d = today();
        (db.stands[d] = db.stands[d] || []).push(Date.now());
        save(); render();
        const c = db.stands[d].length;
        toast(c === slots().length ? '今天的目标完成了，真棒' : `第 ${c} 次，做得好`);
        break;
      }
      case 'undo': {
        const d = today();
        (db.stands[d] || []).pop(); save(); render(); toast('已撤销');
        break;
      }
      case 'save': saveSettings(); break;
      case 'close': closeModal(); break;
      case 'icsGuide': openIcsGuide(); break;
      case 'ics': downloadIcs(); closeModal(); render(); break;
      case 'icsStatic': S().icsDone = true; save(); break;
    }
  });

  setInterval(() => { if (!document.hidden && $('#modal').classList.contains('hidden')) render(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('#modal').classList.contains('hidden')) render(); });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  window.__rh = { buildIcs, slots, db: () => db };
  render();
})();
