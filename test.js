import { Sudoku, new_board, is_single, cross_box, solve_quest, ANY, XPOS, YPOS, ROOM } from './sudoku.js';

const dump_bin = (dat) => {
  for (let y = 0; y < 9; ++y) {
    let str = '';
    const yp = y * 9;
    for (let x = 0; x < 9; ++x) {
      str += dat[x + yp].toString(2).padStart(10, '0');
      str += x != 8? (x % 3 == 2? ',  ': ', '): ',';
    }
    console.log(str + (y % 3 == 2? '\n': ''));
  }
};

const dump = (dat) => {
  const bar = '+-------+-------+-------+';
  console.log(bar);
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
        case 0b111111111: str += '_'; break;
        default:          str += '.'; break;
      }
      str += x != 8? (x % 3 == 2? ' | ': ' '): ' |';
    }
    console.log(str);
    if (y % 3 == 2) console.log(bar);
  }
};

const is_mujun = (dat) => {
  for (let i = 0; i < 81; ++i) {
    if (!is_single(dat[i])) return true;
    let x = dat[i];
    let y = dat[i];
    let b = dat[i];
    cross_box(i, (p, ty) => {
      switch (ty) {
        case XPOS: x |= dat[p]; break;
        case YPOS: y |= dat[p]; break;
        case ROOM: b |= dat[p]; break;
      }
    });
    if (x != ANY || y != ANY || b != ANY) return true;
  }
  return false;
};

////////////////////////////////////////////////////////////////////////////

function ans_test() {
  console.log('ans_test: 正解を作る');
  const su = new Sudoku();
  console.log('seed:', su.seed);
  const ans = su.create_ans();
  dump(ans);
  console.log('矛盾:', is_mujun(ans)? 'あり': 'なし');
}

function open_test() {
  console.log('open_test: 正解から対称的にヒントを開示。解けるかは不明');
  const su = new Sudoku();
  console.log('seed:', su.seed);
  const ans = su.create_ans();
  const dat = new_board();
  const que = new_board();
  su.open_duo(dat, que, ans, Sudoku.SAYU);
  dump(que);
}

function open_test2() {
  console.log('open_test 2: 正解から合理的に正解できるまで開示');
  const su = new Sudoku();
  console.log('seed:', su.seed);
  const ans = su.create_ans();
  const dat = new_board();
  const que = new_board();
  su.open_duo(dat, que, ans, Sudoku.CENTER);
  let cnt = 0;
  while (su.open_duo(dat, que, ans, Sudoku.CENTER, 1)) {
    cnt += 1;
    if (cnt % 100 == 99) console.log(cnt);
  }
  dump(que);
}

function slim_test() {
  console.log('slim_test: 適当に作った問題から不要なヒントを除外');
  const su = new Sudoku();
  console.log('seed:', su.seed);
  const ans = su.create_ans();
  const dat = new_board();
  const que = new_board();
  su.open_duo(dat, que, ans, Sudoku.CENTER);
  while (su.open_duo(dat, que, ans, Sudoku.CENTER, 1));
  const skip = su.slim(que);
  if (skip.length) {
    const slim = new_board();
    let hint = 0;
    for (let i = 0; i < 81; ++i) {
      if (!skip.includes(i)) {
        slim[i] = que[i];
        if (que[i] != ANY) hint += 1;
      }
    }
    const level = solve_quest(slim);
    if (level) {
      console.log("解ける");
      console.log(`level: ${level}`);
      console.log(`hint: ${hint}  (81-h = ${81-hint})`);
      dump(slim);
    } else {
      throw new Error("解けない！");
      dump(slim);
    }
  } else {
    dump(que);
    throw new Error("！スリム化失敗");
  }
}

function translate_test() {
  console.log('slim_test: 適当に作った問題から不要なヒントを除外');
  const su = new Sudoku();
  console.log('seed:', su.seed);
  const ans = su.create_ans();
  const dat = new_board();
  const que = new_board();
  su.open_duo(dat, que, ans, Sudoku.CENTER);
  while (su.open_duo(dat, que, ans, Sudoku.CENTER, 1));
  const skip = su.slim(que);
  if (skip.length) {
    const slim = new_board();
    let hint = 0;
    for (let i = 0; i < 81; ++i) {
      if (!skip.includes(i)) {
        slim[i] = que[i];
        if (que[i] != ANY) hint += 1;
      }
    }
    const level = solve_quest(slim);
    if (level) {
      console.log(`解ける: level: ${level}, hint: ${hint}  (81-h = ${81-hint})`);
      dump(slim);
      const tra = su.translate({
        quest: slim,
        hint : hint, // count
        ans  : ans
      });
      const level_2 = solve_quest(tra.quest);
      if (level_2) {
        console.log(`翻訳後: 解ける: level: ${level_2}, hint: ${tra.hint}`);
        dump(tra.quest);
      } else {
        throw new Error("翻訳後が解けない");
        dump(tra.quest);
      }
    } else {
      throw new Error("解けない！");
      dump(slim);
    }
  } else {
    dump(que);
    throw new Error("！スリム化失敗");
  }
}

function taisho_test() {
  const su = new Sudoku();
  for (let k = 0; k < Sudoku.TYPE_MAX; ++k) {
    console.log(['CENTER', 'JOGE','SAYU','GKESA','KESA'][k]);
    for (let i = 0; i < 81; ++i) {
      const t = su.get_taisho(i);
      if (t < 0 || t >= 81) {
        console.log(`err at ${i}, t = ${t}`);
      }
    }
  }
}

function 問題作成(seed = Math.trunc(Math.random() * 200000000) + 1) {
  const su = new Sudoku(seed);
  su.create_quest().then(q => {
    console.log(`create_quest: seed = ${seed.toString(16)}(${seed})`);
    const k = (q.lv - 1) + (81-q.hint);
    console.log(`Lv: ${q.lv - 1}, Hint: ${q.hint}(${81-q.hint}), k: ${k}`);
    dump(q.quest);
  });
}

const okini = [0x9a5b0f3, 0x279911, 142702495];
問題作成();//okini[0]);


