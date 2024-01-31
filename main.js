import { Sudoku, ANY, bit2num, cross_box } from './sudoku.js';
import { get_hint, create_dialog } from './hint.js';

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
   */
  cursor_bit    : ANY,    // ツールの初期状態
  start_time    : 0,      // 開始時刻
  pause_time    : 0,      // 中断したら
  timer_id      : 0,      // timeout のID
  game_id       : '',     // S([hex]+) で、hex > 0 な乱数
  history       : [],     // プレイの記録
  quest         : null,   // プレイ中の盤面状態: 初期状態のquestは変更不能とする
  ans           : null,   // 正解の局面
  hint          : 0,      // 初期状態のquestにあるヒント数
  lv            : 0,      // solve関数が解くために使った回数
  url           : '',     // クリップボードにコピーするためのベースURL
  mokuhyo       : 100000, // 目標点, デフォ１０万
  next_game     : null,   // 次のゲーム（内部でつくる）
  score_list    : [],     // ハイスコアのリスト
  is_first_game : false,  // これが最初にロードされた状態か
  is_played     : false,  // プレイしたことがあるIDか
};

const dump = (dat, print = true) => {
  if (print) console.log('+-------+ cheat +-------+');
  let result = '';
  for (let y = 0; y < 9; ++y) {
    let str = '| ';
    const yp = y * 9;
    for (let x = 0; x < 9; ++x) {
      let a;
      switch (dat[x + yp]) {
        case 0b000000000: a = 'e'; break;
        case 0b000000001: a = '1'; break;
        case 0b000000010: a = '2'; break;
        case 0b000000100: a = '3'; break;
        case 0b000001000: a = '4'; break;
        case 0b000010000: a = '5'; break;
        case 0b000100000: a = '6'; break;
        case 0b001000000: a = '7'; break;
        case 0b010000000: a = '8'; break;
        case 0b100000000: a = '9'; break;
        case 0b111111111: a = '0'; break;
        default:          a = '_'; break;
      }
      result += a;
      if (print) {
        str += a;
        str += x != 8? (x % 3 == 2? ' | ': ' '): ' |';
      }
    }
    if (print) {
      console.log(str);
      if (y % 3 == 2) {
        console.log('+-------+-------+-------+');
      }
    }
  }
  return result;
};

// 数を S[hex]+ に変換
const make_id_str = (num_id) => {
  return 'S' + num_id.toString(16).toUpperCase();
};

// プレイ済みか判定
const is_played = (num_id) => {
  const data = localStorage.getItem('score_list');
  if (!data) return false;
  const id = make_id_str(num_id);
  const lst = JSON.parse(data);
  for (let l of lst) {
    if (l.id == id) return true;
  }
  return false;
};

const rand_num = () => {
  return Math.trunc(Math.random() * 200000000) + 1;
};

const make_random_id = () => {
  const data = localStorage.getItem('score_list');
  if (!data) return rand_num();
  const lst = JSON.parse(data);
  for (let i = 0; i < 10000000; ++i) {
    const rnd = rand_num();
    const id = make_id_str(rnd);
    let flag = true;
    for (let l of lst) {
      if (l.id == id) {
        flag = false;
        break;
      }
    }
    if (flag) return rnd;
  }
  alert('問題作成に失敗しました。リロードします');
  window.location.href = '/';
};


const css_off = (el, class_name, is_add = false) => {
  // あるなら除外
  if (el.classList.contains(class_name)) {
    el.classList.remove(class_name);
  } else if (is_add) {
    // ないなら, is_add = true のときだけ追加
    el.classList.add(class_name);
  }
};

const add_history = (pos, bit) => {
  if (g_game.history.length < 81) {
    g_game.history.push({
      pos: pos,
      pt : 81 - g_game.history.length,
      num: bit,
    });
    // len = 81 のとき '0 PLACE' になる
    document.getElementById('title_bar').textContent =
      `${81 - g_game.history.length} PLACE`;
  }
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
  } else if (s == 'playing' || s == 'pause' || s == 'end') {
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
  g_game.state = 'end'; // END
  clearTimeout(g_game.timer_id); // Stop!
  const end_time = Date.now() - g_game.start_time + g_game.pause_time; // 時間
  // 最終スコア計算
  const uniq_pos = new Set();
  let score = 0;
  for (let i = g_game.history.length - 1; i >= 0; --i) { // 最後から見ていく
    const cur = g_game.history[i];
    if (cur.num == ANY) continue; // 消しゴムは飛ばす
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
  let rank = 1;
  for (let i = 0; i < g_game.score_list.length; ++i) {
    if (final_score < g_game.score_list[i].score) rank += 1;
  }
  const wow =
    final_score >= g_game.mokuhyo? `≧ ${g_game.mokuhyo.toLocaleString()}pt!!!`:
    `- 目標 ${g_game.mokuhyo.toLocaleString()}pt まで残り ${(g_game.mokuhyo - final_score).toLocaleString()}pt`;
  /* log
  console.log(`CLEAR: ${final_score.toLocaleString()}pt ${wow}`);
  console.log(`base: ${score.toLocaleString()}pt`);
  console.log(`time: ${t50.toLocaleString()}(${end_time.toLocaleString()}ms)`);
  console.log(`bonus = ${score}pt - ${t50}time = ${bonus}`);
  // */
  // 時間を表示
  const time = ms2hms(end_time);
  document.getElementById('timer').textContent = time;
  // 得点を表示
  const ten = final_score.toLocaleString();
  document.getElementById('title_bar').textContent = ten + 'pt';
  // ハイスコア記録
  add_score(score, time, final_score);
  // 表示を調整
  for (let pos = 0; pos < 81; ++pos) {
    const elm = document.getElementById(`board-${pos}`);
    css_off(elm, 'cur_num');
  }
  // 通知, 再描画させるため一拍置いてalert
  setTimeout(() => alert(
    'CONGRATULATIONS!\n' +
    (g_game.is_played? '※プレイ済みのためスコアは記録されません\n\n':'\n') +
    `SCORE: ${ten}pt (${rank}位)\n` +
    `${wow}\n\n` +
    `TIME : ${time} (${end_time.toLocaleString()}ms)\n` +
    `BASE : ${score.toLocaleString()}pt\n` +
    `BONUS: ${bonus.toLocaleString()}pt\n` +
    `= ${score.toLocaleString()}pt - ${t50.toLocaleString()}time\n` +
    `\nGame URL:\n${g_game.url}?id=${g_game.game_id}`), 100);
};


// 選択中の数字の効きをハイライト
const hi_num = () => {
  if (g_game.state != 'playing') return;
  const bit = g_game.cursor_bit;
  const dont = new Set(); // 'クリックするな' を設定するリスト
  for (let i = 0; i < 81; ++i) {
    const elm = document.getElementById(`board-${i}`);
    if (bit != ANY) { // １〜９の数字のとき
      if (g_game.quest[i] != ANY) { // 今の位置が空白でない
        // それは hintマス or プレイヤが記入したなにか: クリックするなと警告
        dont.add(i);
        if (g_game.quest[i] == bit) { // それが選択中の数字なら効きを算出
          cross_box(i, (p, _) => dont.add(p)); // 効きの範囲もクリックするな
        }
      }
    } else { // ツールが空白のとき
      // hint または ANY は消しゴムしない
      if (elm.classList.contains('hint') || g_game.quest[i] == ANY) {
        dont.add(i);
      }
    }
    // 前のチェックを解除
    css_off(elm, 'cur_num');
  }
  // クリックしないほうが良いマスについて
  for (let pos of dont) {
    const el = document.getElementById(`board-${pos}`);
    // 設定されていないなら追加
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
    } else {
      css_off(elm, 'ng_num');
    }
  }
};

///////////////////////////////////////////////////////////////////////////
// 問題をクリックしたとき
const on_board_click = (e) => {
  if (g_game.state == 'playing' && !e.target.classList.contains('hint')) {
    // 座標
    const ma = e.target.id.match(/board-([0-9]+)/);
    const click_pos = parseInt(ma[1]);
    // ダブルクリックを回避
    if (g_game.quest[click_pos] == g_game.cursor_bit) return;
    // 表示
    const n = bit2num(g_game.cursor_bit); // ANYなら10
    e.target.textContent = n == 10? '': n.toString();
    // 書き込む
    g_game.quest[click_pos] = g_game.cursor_bit;
    add_history(click_pos, g_game.cursor_bit);
    // 更新
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

const create_next = (nid) => {
  const su = new Sudoku(nid);
  su.create_quest().then( q => {
    q.id = make_id_str(nid);
    q.lv = Math.max(1, q.lv - 1);
    g_game.next_game = q;
    //console.log('dekita:', g_game.next_game);
  });
};

const clear_all = () => {
  for (let i = 0; i < 81; ++i) {
    const elm = document.getElementById(`board-${i}`);
    elm.classList.remove('hint');
    elm.classList.remove('cur_num');
    elm.textContent = '';
  }
  for (let i = 10; i > 0; --i) {
    const toi = i == 10? ANY: 1 << (i - 1);
    const elm = document.getElementById('tool-' + toi);
    if (i == 10) {
      elm.classList.add('tool_sel');
    } else {
      elm.classList.remove('tool_sel');
      elm.classList.remove('tool_fill');
    }
  }
  g_game.cursor_bit = ANY;
};

const on_titlebar_click = (e) => {
  if (g_game.state == 'playing') {
    if (window.confirm(`${g_game.history.length < 81? '５手消費して':''}答えをひとつ表示します`)) {
      for (let i = 0; i < 5; ++i) add_history(-1, ANY);
      setTimeout(() => get_hint([...g_game.quest]), 100);
    }
  } else if (g_game.state == 'end' && g_game.next_game) {
    if (window.confirm('NEXT GAME\n- 新しい問題を始めます')) {
      const q = g_game.next_game;
      g_game.quest   = q.quest;
      g_game.ans     = q.ans;
      g_game.hint    = q.hint;
      g_game.lv      = q.lv;
      g_game.game_id = q.id;
      //
      g_game.next_game = null;
      create_next(make_random_id());
      // 消去
      clear_all();
      // スタートできるようにして
      set_start_button();
      // 強制スタート
      on_id_click({ target: document.getElementById('game_id') });
    }
  }
};

// ポーズと再開
const on_timebar_click = (_) => {
  if (g_game.state == 'playing') { // pause
    clearTimeout(g_game.timer_id);
    g_game.pause_time += Date.now() - g_game.start_time; // 差分を追記
    const el = document.getElementById('title_bar');
    el.textContent = 'PAUSE';
    for (let pos = 0; pos < 81; ++pos) {
      const elm = document.getElementById(`board-${pos}`);
      elm.textContent = '';
    }
    g_game.state = 'pause';
  } else if (g_game.state == 'pause') { // 再開
    g_game.start_time = Date.now(); // start_timeをリセットしておく
    const el = document.getElementById('title_bar');
    el.textContent = `${81 - g_game.history.length} PLACE`;
    for (let pos = 0; pos < 81; ++pos) {
      const elm = document.getElementById(`board-${pos}`);
      const n = bit2num(g_game.quest[pos]);
      elm.textContent = n == 10? '': n;
    }
    g_game.state = 'playing';
    show_time();
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
    } else {
      css_off(el, 'tool_fill');
    }
  }
};

// ツールを選択
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
  if (g_game.state != 'playing') return;
  if (/[1-9]/.test(e.key)) {
    set_tool(1 << (parseInt(e.key) - 1));
  } else if (/[qQ]/.test(e.key)) {
    set_tool(1 << 8); // 9
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
  if (g_game.state != 'playing') return;
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

/////////////////////////////////////////////////////
// 日付文字列
const get_date_str = () => {
  const d = new Date();
  return `${d.getFullYear()-2000}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
};

const make_td = (is_td, dat, cls) => {
  const ret = document.createElement(is_td ? 'td': 'th');
  ret.textContent = dat;
  if (cls) ret.classList.add(cls);
  return ret;
};

const set_mokuhyo = (n) => {
  g_game.mokuhyo = n >= 140000? 150000:
                   n >= 130000? 140000:
                   n >= 120000? 130000:
                   n >= 110000? 120000:
                   n >= 100000? 110000:
                   100000;
  // 目標を通知
  document.getElementById('mokuhyo').textContent = `目標: ${g_game.mokuhyo.toLocaleString()}pt`;
};

// スコアを追加
const add_score = (base, time, score) => {
  // プレイ済みはリターン
  if (g_game.is_played) {
    console.log('プレイ済み:', g_game.game_id);
    return;
  }
  // プレイしたことがあるなら
  const obj = {
    date    : get_date_str(),
    id      : g_game.game_id,
    lv      : g_game.lv,
    hint    : g_game.hint,
    base    : base.toLocaleString(),
    time    : time,
    score   : score,
  };
  if (score >= g_game.mokuhyo) set_mokuhyo(score);
  g_game.score_list.push(obj);
  g_game.score_list.sort((a, b) => b.score - a.score);
  localStorage.setItem('score_list',
    JSON.stringify(g_game.score_list, undefined, 1) );
  //
  const tbody = document.getElementById('score_body');
  if (tbody) {
    const tr = document.createElement('tr');
    tr.appendChild(make_td(true, obj.date));
    tr.appendChild(make_td(true, obj.id));
    tr.appendChild(make_td(true, obj.hint));
    tr.appendChild(make_td(true, obj.base));
    tr.appendChild(make_td(true, obj.time));
    tr.appendChild(make_td(true, obj.score.toLocaleString(), 'add_pt'));
    tbody.appendChild(tr);
  } else {
    create_score_table();
  }
};

// スコアテーブルを作る
const create_score_table = () => {
  const data = localStorage.getItem('score_list');
  if (!data) {
    g_game.score_list = [];
    g_game.is_first_game = true;
    set_mokuhyo(100000 - 1);
    return;
  }
  const lst = JSON.parse(data);
  lst.sort((a, b) => b.score - a.score);
  set_mokuhyo(lst[0].score);
  g_game.score_list = lst;
  ///////////////////////////////////////////////////
  const hs = document.getElementById('hi_score');
  //
  const table = document.createElement('table');
  const th = document.createElement('thead');
  const htr = document.createElement('tr');
  htr.appendChild(make_td(false, 'Date'));
  htr.appendChild(make_td(false, 'ID'));
  htr.appendChild(make_td(false, 'Hint'));
  htr.appendChild(make_td(false, 'Base'));
  htr.appendChild(make_td(false, 'Time'));
  htr.appendChild(make_td(false, 'SCORE'));
  th.appendChild(htr);
  table.appendChild(th);
  //
  const tb = document.createElement('tbody');
  tb.setAttribute('id', 'score_body');
  const len = Math.min(10, lst.length);
  for (let i = 0; i < len; ++i) {
    const tr = document.createElement('tr');
    tr.appendChild(make_td(true, lst[i].date));
    tr.appendChild(make_td(true, lst[i].id));
    tr.appendChild(make_td(true, lst[i].hint));
    tr.appendChild(make_td(true, lst[i].base));
    tr.appendChild(make_td(true, lst[i].time));
    tr.appendChild(make_td(true, lst[i].score.toLocaleString(), 'add_pt'));
    tb.appendChild(tr);
  }
  if (!g_game.is_first_game) {
    // 見出し２つ目
    const tr = document.createElement('tr');
    tr.appendChild(make_td(false, 'Date'  ));
    tr.appendChild(make_td(false, 'ID'    ));
    tr.appendChild(make_td(false, 'Hint'  ));
    tr.appendChild(make_td(false, 'Base'  ));
    tr.appendChild(make_td(false, 'Time'  ));
    tr.appendChild(make_td(false, 'SCORE' ));
    tb.appendChild(tr);
  }
  table.appendChild(tb);
  // button
  const div = document.createElement('div');
  div.setAttribute('class', 'hs_button');
  //
  const relo = document.createElement('button');
  relo.textContent = 'RELOAD';
  relo.addEventListener('click', (e) => {
    const flag = g_game.state == 'pause' || g_game.state == 'playing';
    if (flag) {
      if (window.confirm('この問題を最初からプレイします')) {
        document.location.href = `${g_game.url}?id=${g_game.game_id}`;
      }
    } else {
      document.location.href = g_game.url;
    }
  });
  div.appendChild(relo);
  //
  const del = document.createElement('button');
  del.textContent = 'REMOVE ALL';
  del.addEventListener('click', (e) => {
    if (window.confirm('これまでのスコアをすべて消去します')) {
      localStorage.clear();
      while (hs.firstChild) {
        hs.removeChild(hs.firstChild);
      }
    }
  });
  div.appendChild(del);
  // target
  hs.appendChild(table);
  hs.appendChild(div);
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
    // 新verのIDなら
    const reg = /\?id=S([0-9a-fA-F]+)/;
    if (reg.test(id)) {
      const ma = id.match(reg);
      const  n = parseInt(ma[1], 16);
      if (is_played(n)) {
        if (window.confirm('プレイ済みの盤面です。\nクリアしても記録されませんが、続行しますか？\nキャンセルならID無しのURLにリロードします。')) {
          g_game.is_played = true;
          return n;
        }
        // キャンセルならいっそリロード
        document.location.href = '/';
        return;
      } else if (n) {
        return n; // 0 や NaNじゃない
      } // else => error
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
  // dom
  const game_area = document.getElementById('game_area');
  create_board (game_area);
  create_tool  (game_area);
  create_score_table(); // g_game.score_list
  create_dialog(); // hint.js
  // event
  document.addEventListener('keydown', on_keyboard);
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
  // 問題をつくる
  // score_list != null
  const id = get_game_url(); // ?id=Sxxx があればソレ、無いなら乱数
  const su = new Sudoku(id);
  su.create_quest().then( q => {
    g_game.quest   = q.quest;
    g_game.ans     = q.ans;
    g_game.hint    = q.hint;
    g_game.lv      = Math.max(1, q.lv - 1);
    g_game.game_id = make_id_str(id);
    //dump(q.ans);
    set_start_button();
    create_next(make_random_id());
  });
})();

