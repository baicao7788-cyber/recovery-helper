(() => {
  'use strict';

  const KEY = 'rh_v1';
  const TOTAL_DAYS = 30;
  const DAY_MS = 86400000;

  // ---------- storage ----------
  const blank = () => ({ settings: {}, checks: {}, logs: {}, asks: {} });
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      return d ? Object.assign(blank(), d) : blank();
    } catch (e) { return blank(); }
  }
  let db = load();
  const save = () => localStorage.setItem(KEY, JSON.stringify(db));

  // ---------- dates ----------
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY_MS);
  const today = () => ymd(new Date());
  const md = s => { const d = parse(s); return `${d.getMonth() + 1}月${d.getDate()}日`; };
  const WEEKDAY = '日一二三四五六';
  const wd = s => '周' + WEEKDAY[parse(s).getDay()];

  const S = () => db.settings;
  const dayN = s => diffDays(s, S().surgeryDate);

  // ---------- phase content ----------
  function phaseOf(n) {
    if (n <= 0) return { key: 'w0', name: '手术当天', tip: '好好睡，有人陪着，能下床就在屋里慢走几步。', work: '不工作', walk: '屋里慢走几步' };
    if (n <= 7) return { key: 'w1', name: '第 1 周 · 休息为主', tip: '多休息但别一直躺；每天多次短走动，防血栓、助排气。', work: '不工作，不进工作群', walk: '屋里或楼下慢走 5–10 分钟' };
    if (n <= 14) return { key: 'w2', name: '第 2 周 · 慢慢恢复', tip: '体力在回来，但仍不提重物（约 5 公斤以上）、不做剧烈运动。', work: '原则上不工作，回消息不超过半小时', walk: '散步 15 分钟左右，不累为准' };
    if (n <= TOTAL_DAYS) return { key: 'w3', name: '第 3–4 周 · 逐步回到日常', tip: '可以少量远程工作，每小时起身活动；仍不提重物、不盆浴、不同房。', work: '每天不超过 2–4 小时，每 45–60 分钟起身', walk: '散步 20–30 分钟' };
    return { key: 'after', name: '满一个月 · 以复查医嘱为准', tip: '运动、同房、工作强度何时完全恢复，以复查时医生的意见为准。', work: '按复查医嘱', walk: '按医生意见逐步加量' };
  }

  // reminder/checklist items. from/to are day numbers (inclusive) they apply to.
  function baseItems() {
    return [
      { id: 'water', time: '07:30', label: '起床喝一杯温水', from: 1, to: TOTAL_DAYS },
      { id: 'breakfast', time: '08:00', label: '早餐', sub: '看「吃什么」', from: 1, to: TOTAL_DAYS },
      { id: 'walk_am', time: '10:00', label: '上午走动', subFn: n => phaseOf(n).walk, from: 1, to: TOTAL_DAYS },
      { id: 'lunch', time: '12:00', label: '午餐', from: 1, to: TOTAL_DAYS },
      { id: 'nap', time: '13:00', label: '午休 30–60 分钟', from: 1, to: TOTAL_DAYS },
      { id: 'walk_pm', time: '15:30', label: '下午走动', subFn: n => phaseOf(n).walk, from: 1, to: TOTAL_DAYS },
      { id: 'snack', time: '16:00', label: '加餐＋喝水', sub: '水果或酸奶，全天喝水 1.5–2 升', from: 1, to: TOTAL_DAYS },
      { id: 'dinner', time: '18:00', label: '晚餐', from: 1, to: TOTAL_DAYS },
      { id: 'wound', time: '20:30', label: '看一眼伤口', sub: '干燥、无红肿渗液就好', from: 1, to: 14 },
      { id: 'log', time: '21:00', label: '花 30 秒做今天的记录', sub: '在「记录」里', from: 1, to: TOTAL_DAYS },
      { id: 'sleep', time: '22:30', label: '准备睡觉，23 点前睡', from: 1, to: TOTAL_DAYS },
    ];
  }
  function medItems() {
    return (S().meds || []).map((m, i) => ({
      id: 'med_' + i, time: m.time, label: '用药：' + m.name, sub: '按医嘱，不要自行停药', from: 1, to: TOTAL_DAYS, med: true,
    }));
  }
  function itemsFor(n) {
    const k = Math.max(1, n);
    return baseItems().concat(medItems())
      .filter(it => k >= it.from && k <= it.to)
      .sort((a, b) => a.time.localeCompare(b.time));
  }

  // ---------- food ----------
  const FOOD = {
    early: {
      title: '第 1 周：清淡、软、好消化',
      note: '排气之前以流质、半流质为主；排气后再慢慢恢复正常饮食。胀气时先停牛奶、豆浆和甜食。',
      days: [
        ['小米南瓜粥＋蒸蛋羹', '软米饭＋清蒸鲈鱼＋清炒小青菜', '青菜瘦肉粥'],
        ['鸡蛋面片汤', '番茄鸡蛋面＋几片牛肉', '山药排骨汤（撇油）＋软米饭'],
        ['白粥＋肉松＋水煮蛋', '鸡肉蔬菜粥', '鱼片粥＋蒸南瓜'],
        ['燕麦粥＋水煮蛋', '软米饭＋虾仁蒸蛋＋冬瓜汤', '馄饨（少油）＋菠菜'],
      ],
      snack: '香蕉、苹果、梨；排气后可以加无糖酸奶',
    },
    later: {
      title: '第 2 周起：均衡，蛋白质优先',
      note: '每餐一掌心的蛋白（鱼、蛋、瘦肉、豆腐），半盘蔬菜，主食粗细搭配。多喝水、多吃蔬菜，预防便秘。',
      days: [
        ['全麦面包＋鸡蛋＋牛奶', '杂粮饭＋清蒸鱼＋西兰花＋紫菜汤', '番茄牛腩＋米饭＋炒青菜'],
        ['燕麦粥＋茶叶蛋＋小番茄', '米饭＋豆腐虾仁＋炒菠菜', '鸡汤面（撇油）＋凉拌黄瓜'],
        ['杂粮粥＋包子＋鸡蛋', '米饭＋鸡腿肉＋蒜蓉生菜', '清炖鱼头豆腐＋南瓜＋青菜'],
        ['豆浆＋鸡蛋饼', '米饭＋黑椒牛柳（少油）＋荷兰豆', '虾仁馄饨＋凉拌木耳'],
        ['小米粥＋蒸红薯＋鸡蛋', '杂粮饭＋香菇鸡丁＋油麦菜', '鲫鱼豆腐汤＋米饭＋炒西葫芦'],
      ],
      snack: '一份水果＋一小把坚果，或一杯酸奶',
    },
    avoid: [
      '酒：恢复期完全不喝',
      '辛辣、油炸、太油的汤：容易胀气、便秘',
      '蜂王浆、雪蛤、紫河车、来路不明的“调理卵巢”保健品：可能含雌激素，先问医生',
      '正常吃豆制品没问题，不用刻意忌口',
    ],
  };

  // ---------- log form ----------
  const LOG_Q = [
    { id: 'pain', q: '现在的疼痛（0 不痛，10 最痛）', type: 'scale' },
    { id: 'energy', q: '精神和体力', opts: [['差', 1], ['一般', 2], ['还不错', 3], ['很好', 4]] },
    { id: 'mood', q: '心情', opts: [['低落', 1], ['一般', 2], ['平静', 3], ['开心', 4]] },
    { id: 'bloat', q: '腹胀', opts: [['没有', 0], ['有点', 1], ['明显', 2]] },
    { id: 'bowel', q: '今天排便了吗', opts: [['排了', 1], ['还没有', 0]] },
    { id: 'bleed', q: '阴道出血', opts: [['没有', 0], ['少量或褐色', 1], ['比月经还多', 2, 'danger']] },
    { id: 'wound', q: '伤口', opts: [['干燥正常', 0], ['有点红', 1], ['红肿、渗液或裂开', 2, 'danger']] },
    { id: 'fever', q: '体温到 38℃ 或发冷寒战', opts: [['没有', 0], ['有', 1, 'danger']] },
    { id: 'other', q: '有没有下面这些（可多选）', multi: true, opts: [
      ['腹痛越来越重', 'pain_up', 'danger'], ['一条腿肿痛', 'leg', 'danger'], ['胸闷气短', 'chest', 'danger'],
      ['一直吐、不排气', 'vomit', 'danger'], ['都没有', 'none'],
    ] },
  ];

  function redFlags(log) {
    if (!log) return [];
    const f = [];
    if (log.pain >= 8) f.push('疼痛 8 分以上');
    if (log.bleed === 2) f.push('出血比月经还多');
    if (log.wound === 2) f.push('伤口红肿、渗液或裂开');
    if (log.fever === 1) f.push('发烧 38℃ 或寒战');
    const o = log.other || [];
    if (o.includes('pain_up')) f.push('腹痛越来越重');
    if (o.includes('leg')) f.push('一条腿肿痛（警惕血栓）');
    if (o.includes('chest')) f.push('胸闷气短');
    if (o.includes('vomit')) f.push('持续呕吐、不排气');
    return f;
  }

  // ---------- weekly assessment ----------
  function weekRange(k) { return [(k - 1) * 7 + 1, k * 7]; }

  function assess(k) {
    const [a, b] = weekRange(k);
    const nowN = dayN(today());
    const last = Math.min(b, nowN);
    const days = [];
    for (let n = a; n <= last; n++) days.push(n);
    if (!days.length) return null;

    let done = 0, total = 0;
    const logs = [];
    const flags = [];
    days.forEach(n => {
      const date = addDays(S().surgeryDate, n);
      const items = itemsFor(n);
      const c = db.checks[date] || {};
      total += items.length;
      done += items.filter(it => c[it.id]).length;
      const lg = db.logs[date];
      if (lg) {
        logs.push(Object.assign({ n }, lg));
        redFlags(lg).forEach(x => flags.push(`${md(date)}：${x}`));
      }
    });
    const adherence = total ? done / total : 0;
    const adhScore = Math.round(adherence * 40);

    const pains = logs.filter(l => typeof l.pain === 'number');
    const avgPain = pains.length ? pains.reduce((s, l) => s + l.pain, 0) / pains.length : null;
    let painScore = 8;
    if (avgPain !== null) painScore = avgPain <= 3 ? 15 : avgPain <= 6 ? 8 : 0;

    let trendScore = 5, trend = '记录不足';
    if (pains.length >= 3) {
      const h = Math.floor(pains.length / 2);
      const first = pains.slice(0, h).reduce((s, l) => s + l.pain, 0) / h;
      const second = pains.slice(h).reduce((s, l) => s + l.pain, 0) / (pains.length - h);
      if (second < first - 0.4) { trendScore = 10; trend = '在下降'; }
      else if (second > first + 0.4) { trendScore = 0; trend = '在上升'; }
      else if (second <= 2) { trendScore = 10; trend = '一直很轻'; }
      else { trendScore = 5; trend = '持平'; }
    }

    const bowelDays = logs.filter(l => l.bowel === 1).length;
    const bloatAvg = logs.length ? logs.reduce((s, l) => s + (l.bloat || 0), 0) / logs.length : 1;
    let gutScore = 8;
    if (logs.length) {
      gutScore = Math.round((bowelDays / logs.length) * 8 + (1 - bloatAvg / 2) * 7);
    }
    const symScore = Math.max(0, painScore + trendScore + gutScore);

    const subj = logs.filter(l => l.energy || l.mood);
    let subjScore = 10;
    if (subj.length) {
      const avg = subj.reduce((s, l) => s + ((l.energy || 2) + (l.mood || 2)) / 2, 0) / subj.length;
      subjScore = Math.round(((avg - 1) / 3) * 20);
    }

    const score = adhScore + symScore + subjScore;
    let level = score >= 75 ? 'green' : score >= 55 ? 'yellow' : 'red';
    if (flags.length) level = 'red';

    const focus = [];
    const ph = phaseOf(b + 1);
    if (flags.length) focus.push('本周出现过危险信号，请尽快联系医生，按医生意见处理');
    if (adherence < 0.6) focus.push('打卡不到六成：先只盯三件事，按时吃饭、两次走动、23 点前睡');
    if (avgPain !== null && avgPain > 4) focus.push('疼痛偏高：按医嘱用止痛药，减少活动量，复查时告诉医生');
    if (trend === '在上升') focus.push('疼痛在上升：这是需要留意的信号，建议打电话问医生');
    if (logs.length && bowelDays / logs.length < 0.5) focus.push('排便偏少：多喝水、多吃蔬菜水果，饭后走动');
    if (logs.length && bloatAvg >= 1) focus.push('还有腹胀：少吃产气食物（牛奶、豆浆、甜食），饭后慢走');
    if (subj.length && subjScore < 10) focus.push('精神或心情偏低：多和信任的人聊聊，别逼自己干活');
    if (logs.length < Math.min(3, days.length)) focus.push('记录偏少：每晚花 30 秒在「记录」里点一下，评估才准');
    focus.push(`下周节奏：${ph.name}。${ph.tip}`);

    return {
      k, days: days.length, complete: last >= b, adherence, adhScore, symScore, subjScore, score, level,
      avgPain, trend, flags, focus, logsCount: logs.length, pains,
    };
  }

  const LEVEL_TEXT = { green: '恢复顺利', yellow: '基本平稳，有几处要留意', red: '需要重视' };

  function shareText(r) {
    const name = S().name || '';
    const lines = [
      `【${name ? name + '的' : ''}康复周报 · 第 ${r.k} 周】`,
      `总体：${LEVEL_TEXT[r.level]}（${r.score} 分）`,
      `打卡完成 ${Math.round(r.adherence * 100)}%，平均疼痛 ${r.avgPain === null ? '未记录' : r.avgPain.toFixed(1) + ' 分'}，疼痛趋势：${r.trend}`,
    ];
    if (r.flags.length) lines.push('出现过：' + r.flags.join('；'));
    lines.push('下周重点：');
    r.focus.slice(0, 3).forEach((f, i) => lines.push(`${i + 1}. ${f}`));
    return lines.join('\n');
  }

  // ---------- ICS ----------
  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
  function icsDate(dateStr, time) { return dateStr.replace(/-/g, '') + 'T' + time.replace(':', '') + '00'; }
  function fold(line) {
    const out = [];
    let cur = '';
    let bytes = 0;
    for (const ch of line) {
      const b = new TextEncoder().encode(ch).length;
      if (bytes + b > 73) { out.push(cur); cur = ' '; bytes = 1; }
      cur += ch; bytes += b;
    }
    out.push(cur);
    return out.join('\r\n');
  }

  function buildIcs(opts) {
    const s = S();
    const start = opts.startDate;
    const startN = dayN(start);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//recovery-helper//CN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:康复助手'];
    let uidN = 0;
    const ev = (date, time, title, desc, rcount, alarmMin) => {
      uidN++;
      L.push('BEGIN:VEVENT');
      L.push(`UID:rh-${s.surgeryDate}-${uidN}@recovery-helper`);
      L.push('DTSTAMP:' + stamp);
      L.push('DTSTART:' + icsDate(date, time));
      const [h, m] = time.split(':').map(Number);
      const endMin = h * 60 + m + 10;
      L.push('DTEND:' + icsDate(date, `${pad(Math.floor(endMin / 60) % 24)}:${pad(endMin % 60)}`));
      if (rcount && rcount > 1) L.push(`RRULE:FREQ=DAILY;COUNT=${rcount}`);
      L.push(fold('SUMMARY:' + icsEscape(title)));
      if (desc) L.push(fold('DESCRIPTION:' + icsEscape(desc)));
      L.push('BEGIN:VALARM', 'ACTION:DISPLAY', fold('DESCRIPTION:' + icsEscape(title)), `TRIGGER:-PT${alarmMin || 0}M`, 'END:VALARM');
      L.push('END:VEVENT');
    };

    const items = baseItems().concat(medItems());
    items.forEach(it => {
      const from = Math.max(it.from, startN);
      if (from > it.to) return;
      const date = addDays(s.surgeryDate, from);
      const desc = it.subFn ? '第1周慢走5–10分钟，第2周约15分钟，第3–4周20–30分钟' : (it.sub || '');
      const link = opts.url ? `打卡：${opts.url}` : '';
      ev(date, it.time, '康复 · ' + it.label, [desc, link].filter(Boolean).join('\n'), it.to - from + 1, 0);
    });
    [7, 14, 21, 28].forEach(n => {
      if (n < startN) return;
      ev(addDays(s.surgeryDate, n), '20:00', `康复 · 看第 ${n / 7} 周恢复评估`, '打开康复助手「每周」页，愿意的话复制发给照顾小组', 1, 0);
    });
    if (s.followupDate && s.followupDate >= start) {
      ev(s.followupDate, '09:00', '康复 · 术后复查', '带上出院小结；问病理结果、术后用药疗程、多久复查 B 超、要不要查 AMH、何时恢复运动和同房', 1, 24 * 60);
    }
    L.push('END:VCALENDAR');
    return L.join('\r\n') + '\r\n';
  }

  function downloadIcs() {
    const start = dayN(today()) < 1 ? addDays(S().surgeryDate, 1) : today();
    const text = buildIcs({ startDate: start, url: location.href.split('#')[0] });
    const file = new File([text], 'kangfu-reminders.ics', { type: 'text/calendar' });
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = 'kangfu-reminders.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('已生成提醒文件，按提示添加到日历');
  }

  // ---------- UI helpers ----------
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2200);
  }
  function openModal(html) { $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden'); $('#sheet').scrollTop = 0; }
  function closeModal() { $('#modal').classList.add('hidden'); }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal' && S().surgeryDate) closeModal(); });

  const state = { tab: 'today', date: today(), week: null };

  function clampDate(d) {
    const min = addDays(S().surgeryDate, 1);
    const max = today();
    if (max < min) return max;
    if (d < min) return min;
    if (d > max) return max;
    return d;
  }

  function header() {
    $('#hello').textContent = S().name ? `${S().name}，慢慢来` : '康复助手';
    if (!S().surgeryDate) { $('#daybadge').textContent = ''; return; }
    const n = dayN(today());
    $('#daybadge').textContent = n >= 0 ? `术后第 ${n} 天 · 共 ${TOTAL_DAYS} 天` : '还没到手术日';
  }

  function dateBar() {
    const d = state.date;
    const isToday = d === today();
    const atMin = d <= addDays(S().surgeryDate, 1);
    return `<div class="datebar">
      <button data-act="prev" ${atMin ? 'disabled' : ''}>‹ 前一天</button>
      <span class="d">${isToday ? '今天' : md(d)} ${wd(d)}</span>
      <button data-act="next" ${isToday ? 'disabled' : ''}>后一天 ›</button>
    </div>`;
  }

  // ---------- views ----------
  function renderToday() {
    const d = state.date;
    const n = dayN(d);
    const ph = phaseOf(n);
    const items = itemsFor(n);
    const c = db.checks[d] || {};
    const done = items.filter(it => c[it.id]).length;
    const pct = items.length ? Math.round(done / items.length * 100) : 0;
    const fu = S().followupDate;
    const fuLeft = fu ? diffDays(fu, today()) : null;
    const nextUp = items.find(it => !c[it.id]);
    const log = db.logs[d];

    view.innerHTML = `
      ${dateBar()}
      <section class="card phase">
        <h2>${esc(ph.name)}</h2>
        <div class="tip">${esc(ph.tip)}</div>
        <div class="muted" style="margin-top:8px">今天工作：${esc(ph.work)}</div>
        ${fuLeft !== null && fuLeft >= 0 ? `<div class="muted">距离复查还有 ${fuLeft} 天（${md(fu)}）</div>` : ''}
      </section>
      <section class="card">
        <h2>今天的清单 <span class="muted">${done}/${items.length}</span></h2>
        <div class="progress"><i style="width:${pct}%"></i></div>
        ${nextUp && d === today() ? `<div class="muted" style="margin-top:8px">下一件：${esc(nextUp.time)} ${esc(nextUp.label)}</div>` : ''}
        <div style="margin-top:6px">
          ${items.map(it => {
            const sub = it.subFn ? it.subFn(n) : it.sub;
            return `<button class="check ${c[it.id] ? 'done' : ''}" data-check="${it.id}">
              <span class="box">${c[it.id] ? '✓' : ''}</span>
              <span class="time">${esc(it.time)}</span>
              <span class="label">${esc(it.label)}${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span>
            </button>`;
          }).join('')}
        </div>
      </section>
      <section class="card">
        <h2>身体记录</h2>
        ${log ? `<div class="small">已记录：疼痛 ${log.pain ?? '-'} 分${redFlags(log).length ? '，<b style="color:var(--red)">有危险信号</b>' : ''}</div>` : '<div class="muted">今天还没记录，每晚花 30 秒就够</div>'}
        <button class="btn ${log ? 'ghost' : ''}" data-go="log">${log ? '修改记录' : '去记录'}</button>
      </section>
      ${S().icsDone ? '' : `<section class="card">
        <h2>还没导入日历提醒</h2>
        <div class="muted">导入一次，接下来每天到点手机就会响，不用打开这个网页。</div>
        <button class="btn" data-act="ics">导入提醒到日历</button>
      </section>`}
    `;
  }

  function renderLog() {
    const d = state.date;
    const log = db.logs[d] || {};
    const q = LOG_Q.map(x => {
      let body;
      if (x.type === 'scale') {
        body = `<div class="scale">${Array.from({ length: 11 }, (_, i) => `<button class="chip ${log.pain === i ? 'on' : ''} ${i >= 8 ? 'danger' : ''}" data-log="pain" data-v="${i}">${i}</button>`).join('')}</div>`;
      } else {
        body = `<div class="chips">${x.opts.map(([t, v, cls]) => {
          const on = x.multi ? (log[x.id] || []).includes(v) : log[x.id] === v;
          return `<button class="chip ${on ? 'on' : ''} ${cls || ''}" data-log="${x.id}" data-v="${v}" ${x.multi ? 'data-multi="1"' : ''}>${esc(t)}</button>`;
        }).join('')}</div>`;
      }
      return `<div class="q">${esc(x.q)}</div>${body}`;
    }).join('');
    view.innerHTML = `
      ${dateBar()}
      <section class="card">
        <h2>${d === today() ? '今天' : md(d)}的身体记录</h2>
        <div class="muted">点一下就保存，不用全部填。</div>
        ${q}
        <label class="f">想补充的（可不填）</label>
        <textarea class="in" id="note" placeholder="比如：下午有点胀，走了两圈好多了">${esc(log.note || '')}</textarea>
        <button class="btn" data-act="logdone">记好了</button>
      </section>
    `;
  }

  function renderFood() {
    const n = Math.max(1, dayN(state.date));
    const f = n <= 7 ? FOOD.early : FOOD.later;
    const dayMenu = f.days[(n - 1) % f.days.length];
    view.innerHTML = `
      ${dateBar()}
      <section class="card">
        <h2>${esc(f.title)}</h2>
        <div class="muted">${esc(f.note)}</div>
        <h3>${state.date === today() ? '今天' : md(state.date)}可以这样吃</h3>
        <div class="meal"><b>早餐</b><span>${esc(dayMenu[0])}</span></div>
        <div class="meal"><b>午餐</b><span>${esc(dayMenu[1])}</span></div>
        <div class="meal"><b>晚餐</b><span>${esc(dayMenu[2])}</span></div>
        <div class="meal"><b>加餐</b><span>${esc(f.snack)}</span></div>
        <div class="muted" style="margin-top:8px">菜单每天轮换，只是参考；有饮食医嘱时以医嘱为准。</div>
      </section>
      <section class="card">
        <h2>先别碰</h2>
        <ul class="plain">${FOOD.avoid.map(a => `<li>${esc(a)}</li>`).join('')}</ul>
      </section>
      <section class="card">
        <h2>喝水</h2>
        <div>全天 1.5–2 升，少量多次。便秘时再多喝一点，用力排便会牵拉伤口。</div>
      </section>
    `;
  }

  const ASKS = [
    '病理结果是什么？',
    '术后用药吃多久？副作用要注意什么？',
    '以后多久复查一次 B 超？要不要查 CA125？',
    '要不要查 AMH（卵巢储备）？什么时候适合备孕？',
    '什么时候可以恢复运动、同房、正常上班？',
    '第一次月经和平时不一样，正常吗？',
  ];

  function renderWeek() {
    const nowN = dayN(today());
    const maxK = Math.max(1, Math.min(5, Math.ceil(Math.max(1, nowN) / 7)));
    if (!state.week) state.week = nowN >= 7 && nowN % 7 !== 0 ? Math.floor(nowN / 7) : maxK;
    state.week = Math.min(state.week, maxK);
    const r = assess(state.week);
    const ks = Array.from({ length: maxK }, (_, i) => i + 1);
    const fu = S().followupDate;
    const fuLeft = fu ? diffDays(fu, today()) : null;

    let body = '<section class="card"><div class="muted">这一周还没开始。</div></section>';
    if (r) {
      const recent = [];
      const [a] = weekRange(r.k);
      for (let n = a; n < a + 7; n++) {
        const lg = db.logs[addDays(S().surgeryDate, n)];
        recent.push({ n, p: lg && typeof lg.pain === 'number' ? lg.pain : null });
      }
      body = `
      <section class="level ${r.level}">
        <div class="muted">第 ${r.k} 周${r.complete ? '' : `（进行中，已过 ${r.days} 天）`}</div>
        <div class="score">${r.score}<span style="font-size:18px"> 分</span></div>
        <div style="font-weight:700">${LEVEL_TEXT[r.level]}</div>
        <div class="bars">
          <div class="bar"><span>按时打卡</span><div class="progress"><i style="width:${r.adhScore / 40 * 100}%"></i></div><em>${r.adhScore}/40</em></div>
          <div class="bar"><span>身体症状</span><div class="progress"><i style="width:${r.symScore / 40 * 100}%"></i></div><em>${r.symScore}/40</em></div>
          <div class="bar"><span>精神心情</span><div class="progress"><i style="width:${r.subjScore / 20 * 100}%"></i></div><em>${r.subjScore}/20</em></div>
        </div>
        ${r.logsCount < 3 ? '<div class="muted" style="margin-top:6px">记录少于 3 天，结果仅供参考。</div>' : ''}
      </section>
      ${r.flags.length ? `<section class="card sos-card"><h2>本周出现过危险信号</h2><ul class="plain">${r.flags.map(f => `<li>${esc(f)}</li>`).join('')}</ul><div style="margin-top:6px">如果现在还有，请马上联系医生或去医院。</div></section>` : ''}
      <section class="card">
        <h2>疼痛变化</h2>
        <div class="muted">平均 ${r.avgPain === null ? '未记录' : r.avgPain.toFixed(1) + ' 分'} · 趋势：${r.trend}</div>
        <div class="spark" style="margin-bottom:22px">${recent.map(x => `<div style="height:${x.p === null ? 4 : Math.max(6, x.p * 10)}%;${x.p !== null && x.p >= 7 ? 'background:#f3b9b0' : ''}">${x.p === null ? '' : `<b>${x.p}</b>`}<i>第${x.n}天</i></div>`).join('')}</div>
      </section>
      <section class="card">
        <h2>下周重点</h2>
        <ul class="plain">${r.focus.map(f => `<li>${esc(f)}</li>`).join('')}</ul>
        <button class="btn ghost" data-act="share">复制周报，发给照顾小组</button>
      </section>`;
    }

    const asked = db.asks || {};
    view.innerHTML = `
      <div class="weekpick">${ks.map(k => `<button class="chip ${k === state.week ? 'on' : ''}" data-week="${k}">第 ${k} 周</button>`).join('')}</div>
      ${body}
      <section class="card">
        <h2>复查</h2>
        ${fu ? `<div>${md(fu)} ${wd(fu)}${fuLeft > 0 ? `，还有 ${fuLeft} 天` : fuLeft === 0 ? '，就是今天' : '，已经过了'}</div>` : '<div class="muted">还没填复查日期，在右上角「设」里填。</div>'}
        <h3>到时候要问医生的</h3>
        ${ASKS.map((a, i) => `<button class="check ${asked[i] ? 'done' : ''}" data-ask="${i}"><span class="box">${asked[i] ? '✓' : ''}</span><span class="label">${esc(a)}</span></button>`).join('')}
      </section>
      <div class="muted" style="margin:8px 4px 0">这是自我记录工具，评估只是帮你看趋势，不代替医生判断。</div>
    `;
  }

  function render() {
    header();
    document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === state.tab));
    if (!S().surgeryDate) { view.innerHTML = ''; openSettings(true); return; }
    state.date = clampDate(state.date);
    ({ today: renderToday, log: renderLog, food: renderFood, week: renderWeek })[state.tab]();
  }

  // ---------- SOS ----------
  function sosHtml(flags) {
    const s = S();
    const tel = p => p ? `<a class="btn red" href="tel:${esc(p.replace(/\s/g, ''))}">打给 ${esc(p)}</a>` : '';
    return `<div class="sos-card">
      <h2>${flags && flags.length ? '请马上联系医生或去医院' : '出现这些情况，马上就医'}</h2>
      ${flags && flags.length ? `<div style="margin-bottom:8px">你刚记录了：<b>${flags.map(esc).join('、')}</b></div>` : ''}
      <ul class="plain">
        <li>发烧 38℃ 以上，或寒战</li>
        <li>腹痛越来越重，止痛药压不住</li>
        <li>出血比月经还多，或分泌物有异味</li>
        <li>伤口红、肿、渗液、裂开</li>
        <li>一条腿肿痛，或突然胸闷气短</li>
        <li>一直吐、不排气、不排便</li>
      </ul>
    </div>
    ${tel(s.doctorPhone)}
    ${s.carePhone ? `<a class="btn ghost" href="tel:${esc(s.carePhone.replace(/\s/g, ''))}">叫 ${esc(s.careName || '照顾小组')} 过来</a>` : ''}
    <a class="btn red" href="tel:120">拨打 120</a>
    <button class="btn ghost" data-act="close">知道了</button>`;
  }

  // ---------- settings ----------
  function medsToText(m) { return (m || []).map(x => `${x.name} ${x.time}`).join('\n'); }
  function parseMeds(t) {
    return t.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const m = l.match(/(\d{1,2})[:：](\d{2})\s*$/);
      const time = m ? `${pad(Math.min(23, +m[1]))}:${m[2]}` : '08:00';
      const name = (m ? l.slice(0, m.index) : l).trim() || '药';
      return { name, time };
    });
  }

  function openSettings(first) {
    const s = S();
    openModal(`
      <h2>${first ? '先填几项，之后就不用管了' : '设置'}</h2>
      ${first ? '<div class="muted">只存在这台手机里，不会上传。</div>' : ''}
      <label class="f">怎么称呼你</label>
      <input class="in" id="sName" value="${esc(s.name || '')}" placeholder="比如 Julia">
      <label class="f">手术日期 *</label>
      <input class="in" id="sDate" type="date" value="${esc(s.surgeryDate || '')}">
      <label class="f">复查日期（没定可以先空着）</label>
      <input class="in" id="sFu" type="date" value="${esc(s.followupDate || '')}">
      <label class="f">要吃的药（一行一种：药名 时间）</label>
      <textarea class="in" id="sMeds" placeholder="地诺孕素 08:00&#10;止痛药 20:00">${esc(medsToText(s.meds))}</textarea>
      <div class="muted">没有就空着。按出院医嘱填，停药也要问过医生。</div>
      <label class="f">医院或医生电话</label>
      <input class="in" id="sDoc" type="tel" value="${esc(s.doctorPhone || '')}">
      <label class="f">照顾你的人（名字和电话）</label>
      <div class="btn-row">
        <input class="in" id="sCareName" value="${esc(s.careName || '')}" placeholder="名字" style="flex:1">
        <input class="in" id="sCarePhone" type="tel" value="${esc(s.carePhone || '')}" placeholder="电话" style="flex:1.4">
      </div>
      <button class="btn" data-act="saveSettings">${first ? '开始' : '保存'}</button>
      ${first ? '' : `
        <h3 style="margin-top:22px">日历提醒</h3>
        <div class="muted">改了药或复查日期后，重新导入一次。重新导入前，可以先在日历里删掉旧的“康复 ·”提醒。</div>
        <button class="btn ghost" data-act="ics">重新生成提醒</button>
        <h3 style="margin-top:22px">备份</h3>
        <div class="muted">数据只在这台手机的 Safari 里。清理 Safari 或换手机前，先导出备份。</div>
        <div class="btn-row">
          <button class="btn ghost" data-act="export">导出备份</button>
          <button class="btn ghost" data-act="import">导入备份</button>
        </div>
        <input type="file" id="importFile" accept="application/json,.json" class="hidden">
        <button class="btn ghost" data-act="close">关闭</button>`}
    `);
  }

  function saveSettings() {
    const date = $('#sDate').value;
    if (!date) { toast('请先填手术日期'); return; }
    const first = !S().surgeryDate;
    Object.assign(db.settings, {
      name: $('#sName').value.trim(),
      surgeryDate: date,
      followupDate: $('#sFu').value,
      meds: parseMeds($('#sMeds').value),
      doctorPhone: $('#sDoc').value.trim(),
      careName: $('#sCareName').value.trim(),
      carePhone: $('#sCarePhone').value.trim(),
    });
    save();
    closeModal();
    state.date = today();
    render();
    if (first) openIcsGuide();
    else toast('已保存');
  }

  function openIcsGuide() {
    const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
    openModal(`
      <h2>导入每天的提醒</h2>
      <div>点下面的按钮，会生成一个提醒文件，里面是接下来每天的吃饭、走动、用药、记录、睡觉提醒，还有每周评估和复查提醒。</div>
      <ul class="plain">
        <li>弹出“下载”时点<b>下载</b>，再点地址栏旁的下载图标，打开这个文件</li>
        <li>出现日历页面后点<b>全部添加</b></li>
        <li>之后到点手机就会响，不用打开这个网页</li>
      </ul>
      ${standalone ? '<div class="muted" style="margin-top:8px">如果在主屏幕图标里点了没反应，请改用 Safari 打开这个网址再点一次。</div>' : ''}
      <button class="btn" data-act="ics">生成并导入提醒</button>
      <a class="btn ghost" href="reminders.ics" data-act="icsStatic">上面没反应？导入通用版提醒（不含用药和复查）</a>
      <button class="btn ghost" data-act="icsLater">先不导入</button>
      <div class="muted" style="margin-top:12px">想让它像 App 一样：Safari 底部点“分享”→“添加到主屏幕”。</div>
    `);
  }

  function exportData() {
    const text = JSON.stringify(db, null, 1);
    const file = new File([text], `kangfu-backup-${today()}.json`, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: '康复助手备份' }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function importData(file) {
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d.settings || !d.settings.surgeryDate) throw new Error('bad');
        db = Object.assign(blank(), d); save(); closeModal(); render(); toast('已恢复备份');
      } catch (e) { toast('这个文件不是康复助手的备份'); }
    };
    r.readAsText(file);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('已复制，去微信粘贴就行'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('已复制，去微信粘贴就行'); } catch (e2) { toast('复制失败，请长按选择文字'); }
      ta.remove();
    }
  }

  // ---------- events ----------
  document.querySelector('.tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab; render(); window.scrollTo(0, 0);
  });
  $('#btnSettings').addEventListener('click', () => S().surgeryDate && openSettings(false));
  $('#btnSos').addEventListener('click', () => openModal(sosHtml()));

  document.addEventListener('click', e => {
    const t = e.target.closest('[data-check],[data-log],[data-act],[data-go],[data-week],[data-ask]');
    if (!t) return;
    const d = state.date;

    if (t.dataset.check) {
      const c = db.checks[d] = db.checks[d] || {};
      c[t.dataset.check] = !c[t.dataset.check];
      if (!c[t.dataset.check]) delete c[t.dataset.check];
      save(); render();
      const items = itemsFor(dayN(d));
      if (items.every(it => (db.checks[d] || {})[it.id])) toast('今天全部完成，真棒');
      return;
    }
    if (t.dataset.log) {
      const k = t.dataset.log;
      const raw = t.dataset.v;
      const v = isNaN(+raw) ? raw : +raw;
      const log = db.logs[d] = db.logs[d] || {};
      if (t.dataset.multi) {
        let arr = log[k] || [];
        if (v === 'none') arr = arr.includes('none') ? [] : ['none'];
        else {
          arr = arr.filter(x => x !== 'none');
          arr = arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v);
        }
        log[k] = arr;
      } else {
        log[k] = log[k] === v ? undefined : v;
      }
      save();
      const y = window.scrollY;
      render(); window.scrollTo(0, y);
      const flags = redFlags(log);
      if (flags.length && t.classList.contains('danger') && (t.dataset.multi ? (log[k] || []).includes(v) : log[k] === v)) {
        openModal(sosHtml(flags));
      }
      return;
    }
    if (t.dataset.go) { state.tab = t.dataset.go; render(); window.scrollTo(0, 0); return; }
    if (t.dataset.week) { state.week = +t.dataset.week; render(); return; }
    if (t.dataset.ask) {
      db.asks[t.dataset.ask] = !db.asks[t.dataset.ask]; save(); render(); return;
    }

    switch (t.dataset.act) {
      case 'prev': state.date = addDays(d, -1); render(); break;
      case 'next': state.date = addDays(d, 1); render(); break;
      case 'close': closeModal(); break;
      case 'saveSettings': saveSettings(); break;
      case 'ics':
        downloadIcs(); db.settings.icsDone = true; save(); closeModal(); render(); break;
      case 'icsLater': closeModal(); break;
      case 'icsStatic': db.settings.icsDone = true; save(); break;
      case 'export': exportData(); break;
      case 'import': $('#importFile').click(); break;
      case 'share': { const r = assess(state.week); if (r) copy(shareText(r)); break; }
      case 'logdone': {
        const log = db.logs[d] = db.logs[d] || {};
        log.note = $('#note').value.trim();
        save();
        const flags = redFlags(log);
        if (flags.length) openModal(sosHtml(flags));
        else {
          const c = db.checks[d] = db.checks[d] || {};
          c.log = true; save();
          toast('记好了，早点休息');
          state.tab = 'today'; render(); window.scrollTo(0, 0);
        }
        break;
      }
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'importFile' && e.target.files[0]) importData(e.target.files[0]);
  });
  document.addEventListener('input', e => {
    if (e.target.id === 'note') {
      const log = db.logs[state.date] = db.logs[state.date] || {};
      log.note = e.target.value; save();
    }
  });

  // refresh when returning to the app on a new day
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && $('#modal').classList.contains('hidden')) { state.date = today(); render(); }
  });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // expose for tests
  window.__rh = { buildIcs, assess, redFlags, itemsFor, db: () => db };

  render();
})();
