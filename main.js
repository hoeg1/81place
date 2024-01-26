import { Sudoku, ANY, bit2num, cross_box } from './sudoku.js';
// python3 -m http.server 8000
// localhost:8000

////////////////////////////////////////////
// 状態
const g_game = {
  state: 'init', // 状態
  /*
   * init
   * can_start
   * pause
   * playing
   * end
   * restart
   */
  cursor_bit : ANY,    // ツールの初期状態
  start_time : 0,      // 開始時刻
  pause_time : 0,      // 中断したら
  timer_id   : 0,      // timeout のID
  game_id    : '',     // S([hex]+) で、hex > 0 な乱数
  history    : [],     // プレイの記録
  quest      : null,   // プレイ中の盤面状態: 初期状態のquestは変更不能とする
  ans        : null,   // 正解の局面
  hint       : 0,      // 初期状態のquestにあるヒント数
  lv         : 0,      // solve関数が解くために使った回数
  url        : '',     // クリップボードにコピーするためのベースURL
  mokuhyo    : 100000, // 目標点, デフォ１０万
};

////////////////////////////////////////////
// 問題をつくる

/* debug
const dump = (dat) => {
  console.log('+-------+ cheat +-------+');
  const bar = '+-------+-------+-------+';
  for (let y = 0; y < 9; ++y) {
    let str = '| ';
    const yp = y * 9;
    for (let x = 0; x < 9; ++x) {
      switch (dat[x + yp]) {
        case 0b000000000: str += 'e'; break;
        case 0b000000001: str += '1'; break;
        case 0b000000010: str += '2'; break;
        case 0b000000100: str += '3'; break;
        case 0b000001000: str += '4'; break;
        case 0b000010000: str += '5'; break;
        case 0b000100000: str += '6'; break;
        case 0b001000000: str += '7'; break;
        case 0b010000000: str += '8'; break;
        case 0b100000000: str += '9'; break;
        case 0b111111111: str += '.'; break;
        default:          str += '_'; break;
      }
      str += x != 8? (x % 3 == 2? ' | ': ' '): ' |';
    }
    console.log(str);
    if (y % 3 == 2) console.log(bar);
  }
};
// */

const set_game = (nid, button = true) => {
  const su = new Sudoku(nid);
  try { // 念のため
    su.create_quest().then( q => {
      g_game.quest   = q.quest;
      g_game.ans     = q.ans;
      g_game.hint    = q.hint;
      g_game.lv      = Math.max(1, q.lv - 1);
      g_game.game_id = 'S' + nid.toString(16).toUpperCase();
      console.log(`id: ${g_game.game_id}, hint: ${g_game.hint}, lv: ${g_game.lv}`);
      //dump(q.ans);
      if (button) {
        set_start_button();
      } else {
        g_game.state = 'restart';
      }
    });
  } catch (e) {
    alert(e);
  }
};

const make_random_id = () => {
  return Math.trunc(Math.random() * 200000000) + 1;
};


////////////////////////////////////////////
// スタートする処理、タイマ等

const set_start_button = () => {
  document.getElementById('game_id').textContent = '➤ START';
  document.getElementById('timer').textContent   = '00:00:00';
  g_game.history = [];
  g_game.state   = 'can_start';
};

// 問題を描画
const draw_hint = () => {
  for (let pos = 0; pos < 81; ++pos) {
    const cur = g_game.quest[pos];
    const el = document.getElementById(`board-${pos}`);
    if (cur != ANY) {
      el.classList.add('hint');
      el.textContent = bit2num(cur); // ANYではない = 常に数字
    } else {
      el.textContent = '';
    }
  }
  for (let i = 1; i < 10; ++i) {
    const tool = 1 << (i - 1);
    const el = document.getElementById(`tool-${tool}`);
    if (el.classList.contains('tool_fill')) {
      el.classList.remove('tool_fill');
    }
  }
};

// ミリ秒を 00:00:00 に
const ms2hms = (ms) => {
  const s = String( ((ms /    1000) | 0) % 60 ).padStart(2, '0');
  const m = String( ((ms /   60000) | 0) % 60 ).padStart(2, '0');
  const h = String( ((ms / 3600000) | 0) % 24 ).padStart(2, '0');
  return `${h}:${m}:${s}`;
};

const show_time = () => {
  const cur = Date.now() - g_game.start_time + g_game.pause_time;
  const txt = ms2hms(cur);
  const el = document.getElementById('timer');
  if (el.textContent != txt) { // 変化があれば反映
    el.textContent = txt;
  }
  g_game.timer_id = setTimeout(show_time, 40); // ~24fps
};

const on_id_click = (e) => {
  const s = g_game.state;
  if (s == 'can_start') {
    e.target.textContent = g_game.game_id;
    document.getElementById('title_bar').textContent = '81 PLACE';
    draw_hint();
    g_game.pause_time = 0;
    g_game.start_time = Date.now();
    g_game.state = 'playing';
    show_time();
  } else if (s == 'playing' || s == 'pause' || s == 'end' || s == 'restart') {
    console.log('copy:', g_game.url + '?id=' + g_game.game_id);
    navigator.clipboard.writeText(g_game.url + '?id=' + g_game.game_id);
  }
};


////////////////////////////////////////////
// クリア判定

const check_gameover = () => {
  for (let pos = 0; pos < 81; ++pos) {
    if (g_game.quest[pos] != g_game.ans[pos]) return;
  }
  ////////////////////////////////////
  // クリアした
  g_game.state = 'end';
  clearTimeout(g_game.timer_id); // Stop!
  const end_time = Date.now() - g_game.start_time + g_game.pause_time; // 時間
  // 最終スコア計算
  const uniq_pos = new Set();
  let score = 0;
  for (let i = g_game.history.length - 1; i >= 0; --i) { // 最後から見ていく
    const cur = g_game.history[i];
    if (uniq_pos.has(cur.pos)) continue; // クリック位置の重複を除外
    uniq_pos.add(cur.pos);
    // cur.pt = 81 ~ 1
    const n = bit2num(cur.num); // ANYではない = すべて数字で, 1~9
    score += (n * (n + 1) / 2) * cur.pt; // 三角数, 最大87,615pt
  }
  // bonus算出
  const t50 = Math.round(end_time / 50);
  const bonus = Math.max(0, score - t50);
  const final_score = score + bonus;
  const wow = final_score >= g_game.mokuhyo? `≧ ${g_game.mokuhyo.toLocaleString()}pt!!!`:
    `- 目標 ${g_game.mokuhyo.toLocaleString()}pt まで残り ${(g_game.mokuhyo - final_score).toLocaleString()}pt`;
  // log
  console.log(`CLEAR: ${final_score.toLocaleString()}pt ${wow}`);
  console.log(`base: ${score.toLocaleString()}pt`);
  console.log(`time: ${t50.toLocaleString()}(${end_time.toLocaleString()}ms)`);
  console.log(`bonus = ${score}pt - ${t50}time = ${bonus}`);
  // 時間を表示
  const time = ms2hms(end_time);
  document.getElementById('timer').textContent = time;
  // 得点を表示
  const ten = final_score.toLocaleString();
  document.getElementById('title_bar').textContent = ten + 'pt';
  // ハイスコア記録
  add_score(score, time, final_score);
  g_game.state = 'restart';
  for (let pos = 0; pos < 81; ++pos) {
    const elm = document.getElementById(`board-${pos}`);
    if (elm.classList.contains('cur_num')) {
      elm.classList.remove('cur_num');
    }
  }
  // 通知, 再描画させるため一拍置いてalert
  setTimeout(() => alert('CONGRATULATIONS!\n\n' +
    `SCORE: ${ten}pt\n` +
    `${wow}\n\n` +
    `TIME : ${time} (${end_time.toLocaleString()}ms)\n` +
    `BASE : ${score.toLocaleString()}pt\n` +
    `BONUS: ${bonus.toLocaleString()}pt\n` +
    `= ${score.toLocaleString()}pt - ${t50.toLocaleString()}time\n` +
    `\nGame URL:\n${g_game.url}?id=${g_game.game_id}`), 100);
};


// 選択中の数字の効きをハイライト
const hi_num = () => {
  if (g_game.state != 'playing' || document.getElementById('show_hint').checked) return;
  const bit = g_game.cursor_bit;
  const ig = new Set();
  for (let i = 0; i < 81; ++i) {
    const elm = document.getElementById(`board-${i}`);
    if (elm.classList.contains('cur_num')) {
      elm.classList.remove('cur_num');
    }
    if (g_game.quest[i] != ANY) {
      ig.add(i);
      if (bit != ANY && bit == g_game.quest[i]) {
        cross_box(i, (p, _) => ig.add(p));
      }
    }
  }
  for (let pos of ig) {
    const el = document.getElementById(`board-${pos}`);
    if (!el.classList.contains('cur_num')) {
      el.classList.add('cur_num');
    }
  }
};

// 矛盾をチェック
const ng_search = () => {
  const ng = new Set();
  for (let i = 0; i < 81; ++i) {
    const cur = g_game.quest[i];
    cross_box(i, (p, _) => {
      if (g_game.quest[p] == cur) {
        ng.add(i);
        ng.add(p);
      }
    });
  }
  for (let i = 0; i < 81; ++i) {
    const elm = document.getElementById(`board-${i}`);
    if (ng.has(i)) {
      elm.classList.add('ng_num');
    } else if (elm.classList.contains('ng_num')) {
      elm.classList.remove('ng_num');
    }
  }
};

///////////////////////////////////////////////////////////////////////////
// 問題をクリックしたとき
const on_board_click = (e) => {
  if (g_game.state == 'playing' && !e.target.classList.contains('hint')) {
    const ma = e.target.id.match(/board-([0-9]+)/);
    const click_pos = parseInt(ma[1]);
    if (g_game.quest[click_pos] == g_game.cursor_bit) return;
    // 表示
    const n = bit2num(g_game.cursor_bit); // ANYなら10
    e.target.textContent = n == 10? '': n.toString();
    // 書き込む
    g_game.quest[click_pos] = g_game.cursor_bit;
    if (g_game.history.length < 81) {
      g_game.history.push({
        pos: click_pos,
        pt : 81 - g_game.history.length,
        num: g_game.cursor_bit,
      });
      // len = 81 のとき '0 PLACE' になる
      document.getElementById('title_bar').textContent =
        `${81 - g_game.history.length} PLACE`;
    }
    ng_search();
    hi_num();
    check_fill_num();
    check_gameover();
  }
};


////////////////////////////////////////////
// ポーズとゲームオーバー後の処理

// ポーズ：
// ポーズ＝＞ストップしたらその瞬間を＋＝差分に追加
// 再開＝＞スタート・タイムを Date.now() に修正
// 経過時間＝今 - スタート + 差分

const on_titlebar_click = (e) => {
  if (g_game.state == 'playing') { // pause
    clearTimeout(g_game.timer_id);
    g_game.pause_time += Date.now() - g_game.start_time; // 差分を追記
    e.target.textContent = 'PAUSE';
    for (let pos = 0; pos < 81; ++pos) {
      const el = document.getElementById(`board-${pos}`);
      el.textContent = '';
    }
    g_game.state = 'pause';
  } else if (g_game.state == 'pause') { // 再開
    g_game.start_time = Date.now(); // start_timeをリセットしておく
    e.target.textContent = `${81 - g_game.history.length} PLACE`;
    for (let pos = 0; pos < 81; ++pos) {
      const el = document.getElementById(`board-${pos}`);
      const n = bit2num(g_game.quest[pos]);
      el.textContent = n == 10? '': n;
    }
    g_game.state = 'playing';
    show_time();
  } else if (g_game.state == 'restart') {
    if (window.confirm('新しい問題を始めますか？')) {
      document.location.href = g_game.url;
      /*
      set_game(make_random_id());
      for (let pos = 0; pos < 81; ++pos) {
        const elm = document.getElementById(`board-${pos}`);
        if (elm.classList.contains('hint')) {
          elm.classList.remove('hint');
        }
        elm.textContent = '';
      }
      e.target.textContent = '81 PLACE';
      */
    }
  }
};

// 丸投げ
const on_timebar_click = () => {
  if (g_game.state == 'playing' || g_game.state == 'pause') {
    on_titlebar_click( {
      target: document.getElementById('title_bar')
    } );
  }
};

////////////////////////////////////////////
// 書き込む数字を選ぶ

// 置き尽くしたかチェック
const check_fill_num = () => {
  const lst = new Array(11).fill(0);
  for (let i = 0; i < 81; ++i) {
    lst[ bit2num( g_game.quest[i] ) ] += 1;
  }
  for (let i = 1; i < 10; ++i) {
    const tool = 1 << (i - 1);
    const el = document.getElementById(`tool-${tool}`);
    if (lst[i] == 9) {
      el.classList.add('tool_fill');
    } else if (el.classList.contains('tool_fill')) {
      el.classList.remove('tool_fill');
    }
  }
};

const set_tool = (bit) => {
  if (g_game.cursor_bit == bit) return;
  g_game.cursor_bit = bit;
  for (let i = 10; i > 0; --i) {
    const toi = i == 10? ANY: 1 << (i - 1);
    const elm = document.getElementById('tool-' + toi);
    elm.classList.remove('tool_sel');
  }
  document.getElementById('tool-' + bit).classList.add('tool_sel');
  // 効きをハイライト
  hi_num();
};

const on_keyboard = (e) => {
  if (/[1-9]/.test(e.key)) {
    set_tool(1 << (parseInt(e.key) - 1));
  } else if (/[ 0]/.test(e.key)) {
    set_tool(ANY);
  } else if (e.key == 'a') {
    const n = (bit2num(g_game.cursor_bit) + 1) % 10;
    set_tool(n == 0? ANY: 1 << (n - 1));
  } else if (e.key == 'd') {
    const n = bit2num(g_game.cursor_bit) - 1;
    set_tool(n == 0? ANY: 1 << (n - 1));
  }
};

const on_tool_click = (e) => {
  const reg = /tool-([0-9]+)/;
  const ma = e.target.id.match(reg);
  set_tool( parseInt(ma[1]) );
};



////////////////////////////////////////////
// DOMつくる。最初に一度だけ呼ぶ

const mk_tag = (tag) => document.createElement(tag);

const create_board = (tar) => {
  const table = mk_tag('table');
  table.classList.add('board');
  // thead
  {
    const thead = mk_tag('thead');
    const tr = mk_tag('tr');
    //
    const tit = mk_tag('th');
    tit.setAttribute('colspan', '3');
    tit.setAttribute('id', 'title_bar');
    tit.addEventListener('click', on_titlebar_click);
    tit.style.textAlign = 'left';
    tit.textContent = '81 PLACE';
    tr.appendChild(tit);
    //
    const time = mk_tag('th');
    time.setAttribute('colspan', '3');
    time.textContent = '00:00:00';
    time.setAttribute('id', 'timer');
    time.addEventListener('click', on_timebar_click);
    tr.appendChild(time);
    //
    const g_id = mk_tag('th');
    g_id.setAttribute('colspan', '3');
    g_id.style.textAlign = 'right';
    g_id.addEventListener('click', on_id_click);
    g_id.setAttribute('id', 'game_id');
    tr.appendChild(g_id);
    //
    thead.appendChild(tr);
    table.appendChild(thead);
  }
  {
    const tbody = mk_tag('tbody');
    for (let y = 0; y < 9; ++y) {
      const tr = mk_tag('tr');
      for (let x = 0; x < 9; ++x) {
        const td = mk_tag('td');
        if (x == 2 || x == 5) {
          td.classList.add('yoko');
        }
        const pos = x + y * 9;
        td.setAttribute('id', `board-${pos}`);
        td.addEventListener('click', on_board_click);
        tr.appendChild(td);
      }
      if (y == 2 || y == 5) {
        tr.classList.add('shita');
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }
  tar.appendChild(table);
};

const create_tool = (tar) => {
  const table = mk_tag('table');
  table.classList.add('tool');
  {
    const tr = mk_tag('tr');
    for (let i = 10; i > 0; --i) {
      const td = mk_tag('td');
      td.innerHTML = i == 10? '⌫': i;
      // bit
      const toi = i == 10? ANY: 1 << (i - 1);
      td.setAttribute('id', `tool-${toi}`);
      if (i == 10) td.classList.add('tool_sel');
      td.addEventListener('click', on_tool_click);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  tar.appendChild(table);
};



const get_td = (n, key, str) => {
  const td = document.createElement(n >= 0? 'td': 'th');
  const m = n >= 0? localStorage.getItem(`s${n}_${key}`): key;
  if (key === 'score') {
    const num = parseInt(m);
    if (num > g_game.mokuhyo) {
           if (num >= 140000) g_game.mokuhyo = 150000;
      else if (num >= 130000) g_game.mokuhyo = 140000;
      else if (num >= 120000) g_game.mokuhyo = 130000;
      else if (num >= 110000) g_game.mokuhyo = 120000;
      else if (num >= 100000) g_game.mokuhyo = 110000;
      else                    g_game.mokuhyo = 100000;
    }
    td.textContent = num.toLocaleString();
  } else {
    td.textContent = m;
  }
  if (str) td.classList.add(str);
  return td;
};

const add_score = (base, time, score) => {
  let len = localStorage.getItem('score_len');
  if (!len) len = 0;
  else len = parseInt(len);
  localStorage.setItem('score_len', len + 1);
  const ds = get_date_str();
  localStorage.setItem(`s${len}_date`, ds);
  localStorage.setItem(`s${len}_id`, g_game.game_id);
  localStorage.setItem(`s${len}_lv`, g_game.lv);
  localStorage.setItem(`s${len}_hint`, g_game.hint);
  localStorage.setItem(`s${len}_base`, base.toLocaleString());
  localStorage.setItem(`s${len}_time`, time);
  localStorage.setItem(`s${len}_score`, score);
  //
  const tbody = document.getElementById('score_body');
  if (tbody) {
    const tr = document.createElement('tr');
    tr.appendChild(get_td(len, 'date'));
    tr.appendChild(get_td(len, 'id'));
    tr.appendChild(get_td(len, 'hint'));
    tr.appendChild(get_td(len, 'base'));
    tr.appendChild(get_td(len, 'time'));
    tr.appendChild(get_td(len, 'score', 'add_pt'));
    tbody.appendChild(tr);
  } else {
    load_score();
  }
};

const get_date_str = () => {
  const d = new Date();
  return `${d.getFullYear()-2000}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const load_score = () => {
  const len = localStorage.getItem('score_len');
  if (!len) return;
  const table = document.createElement('table');
  const th = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.appendChild(get_td(-1, 'Date'));
  htr.appendChild(get_td(-1, 'ID'));
  htr.appendChild(get_td(-1, 'Hint'));
  htr.appendChild(get_td(-1, 'Base'));
  htr.appendChild(get_td(-1, 'Time'));
  htr.appendChild(get_td(-1, 'SCORE'));
  th.appendChild(htr);
  table.appendChild(th);
  const tb = document.createElement('tbody');
  tb.setAttribute('id', 'score_body');
  for (let i = 0; i < parseInt(len); ++i) {
    const tr = document.createElement('tr');
    tr.appendChild(get_td(i, 'date'));
    tr.appendChild(get_td(i, 'id'));
    tr.appendChild(get_td(i, 'hint'));
    tr.appendChild(get_td(i, 'base'));
    tr.appendChild(get_td(i, 'time'));
    tr.appendChild(get_td(i, 'score', 'add_pt'));
    tb.appendChild(tr);
  }
  table.appendChild(tb);


  const hs = document.getElementById('hi_score');
  // button
  const btn = document.createElement('button');
  btn.textContent = 'REMOVE ALL';
  btn.addEventListener('click', (e) => {
    if (window.confirm('これまでの履歴をすべて消去します')) {
      localStorage.clear();
      while (hs.firstChild) {
        hs.removeChild(hs.firstChild);
      }
    }
  });
  //
  hs.appendChild(table);
  hs.appendChild(btn);
};

////////////////////////////////////////////
// 最初に一回だけ

// url/?hoge について、hoge からシードを読み取る
const get_game_url = () => {
  const id = location.search;
  if (id) {
    // コピーできるようアドレスを取っておく
    g_game.url = (location.href).replace(/\?.+/, '');
    const old = /\?id=N[0-9a-fA-F]+P[2-9][0-9]/;
    if (old.test(id)) {
      const ma = id.match(old);
      const url = g_game.url + 'v1/' + ma[0];
      console.log('移動:', url);
      alert(`古いID: '${id}' を検出しました。\n${url}\nに移動します。`);
      // move to
      document.location.href = url;
      return;
    }
    // 新IDなら
    const reg = /\?id=S([0-9a-fA-F]+)/;
    if (reg.test(id)) {
      const ma = id.match(reg);
      const  n = parseInt(ma[1], 16);
      if (n) return n; // 0 や NaNじゃない
    }
    alert(`エラー\nID: '${id}' の読み込みに失敗しました。\n自動生成します。`);
  }
  if (g_game.url == '') g_game.url = location.href;
  return make_random_id();
};

//////////////////
// satart
(() => {
  g_game.state = 'init';
  // event
  document.addEventListener('keydown', on_keyboard);
  const game_area = document.getElementById('game_area');
  const rule = document.getElementById('rule_tit_but');
  rule.textContent = '➤ 遊び方 (click)';
  const book = document.getElementById('rule_book_div');
  //book.style.display = 'none';
  rule.addEventListener('click', () => {
    if (book.style.display != 'block') {
      rule.textContent = '▼ 遊び方';
      book.style.display = 'block';
      book.hidden = false;
    } else {
      rule.textContent = '➤ 遊び方';
      book.style.display = 'none';
      book.hidden = true;
    }
  });
  const hi_chk = document.getElementById('show_hint');
  hi_chk.addEventListener('change', (e) => {
    console.log('hello');
    if (hi_chk.checked) {
    console.log('hi off');
      for (let i = 0; i < 81; ++i) {
        const elm = document.getElementById(`board-${i}`);
        if (elm.classList.contains('cur_num')) {
          elm.classList.remove('cur_num');
        }
      }
    }
  });
  // dom
  create_board (game_area);
  create_tool  (game_area);
  load_score();
  // 問題
  set_game(get_game_url()); // ?id=Sxxx があればソレ、無いなら乱数
})();


