import { NumberPlace } from './NumberPlace.js';
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
   *
   */
  cursor_bit: NumberPlace.ANY,
  start_time: 0, // 開始時刻
  pause_time: 0, // 中断したら
  timer_id:   0, // timeout id
  game_id: '',
  id_yobi: '', // 予備のid
  history: [], // プレイの記録
  quest     : null,
  ans       : null,
  hint_count: 0,
  err_tar: null,
  url: '',
};

////////////////////////////////////////////
// 問題をつくる

const start_worker = (id, button = true) => {
  g_game.game_id = id;
  const w = new Worker('worker.js', {type: 'module'});
  // 送信
  w.postMessage({
    type: 'create',
    game_id: id
  });
  // 受信
  w.onmessage = (e) => {
    const mondai = e.data.result;
    g_game.quest      = mondai.quest;
    g_game.ans        = mondai.ans;
    g_game.hint_count = mondai.hint;
    if (button) {
      set_start_button();
    } else {
      g_game.state = 'restart';
    }
  };
};

const make_random_id = () => {
  const HINTS = [28, 29, 30, 31, 32, 32, 33, 33, 34];
  return NumberPlace.create_id_str(
      Math.trunc(Math.random() * 200000000), // 2 億
      HINTS[(Math.random() * HINTS.length) | 0]
    );
};


////////////////////////////////////////////
// スタートする処理、タイマ等

const set_start_button = () => {
  document.getElementById('game_id').textContent = '➤ START';
  document.getElementById('timer').textContent   = '00:00:00';
  g_game.id_yobi = g_game.game_id;
  g_game.history = [];
  g_game.state   = 'can_start';
};

// 問題を描画
const draw_hint = () => {
  for (let pos = 0; pos < 81; ++pos) {
    const cur = g_game.quest[pos];
    const el = document.getElementById(`board-${pos}`);
    if (cur != NumberPlace.ANY) {
      el.classList.add('hint');
      el.textContent = NumberPlace.bit2num(cur); // ANYではない = 常に数字
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
    g_game.err_tar = null;
    g_game.state = 'playing';
    show_time();
  } else if (s == 'playing' || s == 'pause' || s == 'end' || s == 'restart') {
    console.log('copy:', g_game.url + '?id=' + g_game.id_yobi);
    navigator.clipboard.writeText(g_game.url + '?id=' + g_game.id_yobi);
  }
};


////////////////////////////////////////////
// クリックしたとき＆クリア判定

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
    const n = NumberPlace.bit2num(cur.num); // ANYではない = すべて数字で, 1~9
    score += (n * (n + 1) / 2) * cur.pt; // 三角数, 最大87,615pt
  }
  // bonus算出
  const mokuhyo = 120000; // 目標点
  const t50 = Math.round(end_time / 50);
  const bonus = Math.max(0, score - t50);
  const final_score = score + bonus;
  const wow = final_score >= mokuhyo? `≧ ${mokuhyo.toLocaleString()}pt!!`:
    `- 目標 ${mokuhyo.toLocaleString()}pt まで残り ${(mokuhyo - final_score).toLocaleString()}pt`;
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
  // 次の問題をこっそり作っておく
  start_worker(make_random_id(), false);
  // 通知, 再描画させるため一拍置いてalert
  setTimeout(() => alert('CONGRATULATIONS!\n\n' +
    `SCORE: ${ten}pt\n` +
    `${wow}\n\n` +
    `TIME : ${time} (${end_time.toLocaleString()}ms)\n` +
    `BASE : ${score.toLocaleString()}pt\n` +
    `BONUS: ${bonus.toLocaleString()}pt\n` +
    `= ${score.toLocaleString()}pt - ${t50.toLocaleString()}time\n` +
    `\nGame URL:\n${g_game.url}?id=${g_game.id_yobi}`), 100);
};


///////////////////////////////////////////////////////////////////////////
// 問題をクリックしたとき
const on_board_click = (e) => {
  if (g_game.state == 'playing' && !e.target.classList.contains('hint')) {
    const ma = e.target.id.match(/board-([0-9]+)/);
    const click_pos = parseInt(ma[1]);
    if (g_game.quest[click_pos] == g_game.cursor_bit) return;
    // 表示
    const n = NumberPlace.bit2num(g_game.cursor_bit);
    e.target.textContent = n == 10? '': n.toString();
    if (e.target.classList.contains('put_anime')) {
      e.target.classList.remove('put_anime');
    }
    // 前の手番で即エラーなら赤色を非表示
    if (g_game.err_tar) {
      g_game.err_tar.classList.remove('put_err');
      g_game.err_tar = null;
    }
    // 消しゴムではなくて、その数字が即エラーな局面なら
    if (n != 10 && NumberPlace.find_same(g_game.quest, click_pos, g_game.cursor_bit)) {
      // 赤く強調
      e.target.classList.add('put_err');
      g_game.err_tar = e.target;
    } else {
      // でなければ穏当に青く表示する＝実は致命的な矛盾かもしれないが探索しない
      e.target.classList.add('put_anime');
    }
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
      const n = NumberPlace.bit2num(g_game.quest[pos]);
      el.textContent = n == 10? '': n;
    }
    g_game.state = 'playing';
    show_time();
  } else if (g_game.state == 'restart') {
    if (window.confirm('新しい問題を始めますか？')) {
      for (let pos = 0; pos < 81; ++pos) {
        const elm = document.getElementById(`board-${pos}`);
        // 余計なスタイルを除去
        if (elm.classList.contains('put_anime')) {
          elm.classList.remove('put_anime');
        }
        if (elm.classList.contains('put_err')) {
          elm.classList.remove('put_err');
        }
        if (elm.classList.contains('hint')) {
          elm.classList.remove('hint');
        }
        elm.textContent = '';
      }
      e.target.textContent = '81 PLACE';
      set_start_button();
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

const check_fill_num = () => {
  const lst = new Array(11).fill(0);
  for (let i = 0; i < 81; ++i) {
    lst[ NumberPlace.bit2num( g_game.quest[i] ) ] += 1;
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
    const toi = i == 10? NumberPlace.ANY: 1 << (i - 1);
    const elm = document.getElementById('tool-' + toi);
    elm.classList.remove('tool_sel');
  }
  document.getElementById('tool-' + bit).classList.add('tool_sel');
};

const on_keyboard = (e) => {
  if (/[1-9]/.test(e.key)) {
    set_tool(1 << (parseInt(e.key) - 1));
  } else if (/[ 0]/.test(e.key)) {
    set_tool(NumberPlace.ANY);
  } else if (e.key == 'a') {
    const n = (NumberPlace.bit2num(g_game.cursor_bit) + 1) % 10;
    set_tool(n == 0? NumberPlace.ANY: 1 << (n - 1));
  } else if (e.key == 'd') {
    const n = NumberPlace.bit2num(g_game.cursor_bit) - 1;
    set_tool(n == 0? NumberPlace.ANY: 1 << (n - 1));
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
      const toi = i == 10? NumberPlace.ANY: 1 << (i - 1);
      td.setAttribute('id', `tool-${toi}`);
      if (i == 10) td.classList.add('tool_sel');
      td.addEventListener('click', on_tool_click);
      tr.appendChild(td);
    }
    table.appendChild(tr);
  }
  tar.appendChild(table);
};

////////////////////////////////////////////
// 最初に一回だけ

// url/?hoge について、hoge からシードを読み取る
const get_game_url = () => {
  const id = location.search;
  if (id) {
    // コピーできるようアドレスを取っておく
    g_game.url = (location.href).replace(/\?.+/, '');
    const reg = /\?id=(N[0-9a-fA-F]+P[2-5][0-9])/;
    if (reg.test(id)) {
      const ma = id.match(reg);
      console.log(`url: '${g_game.url}', ma[0]: ${ma[0]}`);
      return ma[1];
    }
    alert(`エラー\nID: '${id}' の読み込みに失敗しました。自動生成します。`);
  }
  if (g_game.url == '') g_game.url = location.href;
  return make_random_id();
};


// satart
(() => {
  g_game.state = 'init';
  // event
  document.addEventListener('keydown', on_keyboard);
  const game_area = document.getElementById('game_area');
  const rule = document.getElementById('rule_tit_but');
  rule.textContent = '➤ 遊び方 (click)';
  const book = document.getElementById('rule_book_div');
  book.style.display = 'none';
  rule.addEventListener('click', () => {
    if (book.style.display == 'none') {
      rule.textContent = '▼ 遊び方';
      book.style.display = 'block';
    } else {
      rule.textContent = '➤ 遊び方';
      book.style.display = 'none';
    }
  });
  // dom
  create_board (game_area);
  create_tool  (game_area);
  // 問題
  start_worker(get_game_url()); // ?xxx があればソレ、無いなら乱数
})();

//http://localhost:8000/?N6F96314P27


