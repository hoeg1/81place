export const ANY = 0b111111111; // (1 << 9) - 1

export const XPOS = 0;
export const YPOS = 1;
export const ROOM = 2;

export const cross_box = (pos, call_back) => {
  const x = pos % 9;
  const y = Math.trunc(pos / 9);
  const xstart = y * 9;
  const bx = x - (x % 3);
  const by = y - (y % 3);
  const bstart = bx + by * 9;
  for (let i = 0, bstep = 0; i < 9; ++i) {
    const tx = xstart + i;
    if (tx != pos) call_back(tx, XPOS);
    const ty = x + i * 9;
    if (ty != pos) call_back(ty,  YPOS);
    const i3 = i % 3;
    const bp = bstart + bstep + i3;
    if (bp != pos) call_back(bp, ROOM);
    if (i3 == 2) bstep += 9;
  }
};

export const is_single = (bit) => {
  return bit != 0 && (bit & -bit) == bit;
};

export const new_board = () => {
  return new Array(81).fill(ANY);
};

export const put_number = (dat, pos, num_bit) => {
  dat[pos] = num_bit;
  let result = true;
  cross_box(pos, (p, _) => {
    if (result && (dat[p] & num_bit)) {
      dat[p] &= ~num_bit;
      if (dat[p] == 0) result = false;
      else if (is_single(dat[p])) {
        put_number(dat, p, dat[p]);
      }
    }
  });
  return result;
};

export const solve = (dat) => {
  let next = true;
  let level = 1;
  let cnt;
  while (next) {
    next = false;
    cnt = 0;
    for (let pos = 0; pos < 81; ++pos) {
      const cur = dat[pos];
      if (cur == 0) return 0; //{ throw new Error(`dat[${pos}] = 0`); }
      if (is_single(cur)) {
        cnt += 1;
        if (cnt == 81) return level;
        else continue;
      }
      let xf = 0;
      let yf = 0;
      let bf = 0;
      cross_box(pos, (p, ty) => {
        switch (ty) {
          case XPOS: xf |= dat[p]; break;
          case YPOS: yf |= dat[p]; break;
          case ROOM: bf |= dat[p]; break;
        }
      });
      const x = (xf ^ cur) & cur;
      const y = (yf ^ cur) & cur;
      const b = (bf ^ cur) & cur;
      if (is_single(x)) {
        put_number(dat, pos, x);
        next = true;
      } else if (is_single(y)) {
        put_number(dat, pos, y);
        next = true;
      } else if (is_single(b)) {
        put_number(dat, pos, b);
        next = true;
      }
    } // end for
    if (next) {
      level += 1;
    }
  }
  return 0;
};


export const solve_quest = (que) => {
  const dat = new_board();
  for (let i = 0; i < 81; ++i) {
    if (que[i] != ANY) put_number(dat, i, que[i]);
  }
  return solve(dat);
};


export const bit2num = (bit) => {
  switch (bit) {
    case 0b000000001: return  1;
    case 0b000000010: return  2;
    case 0b000000100: return  3;
    case 0b000001000: return  4;
    case 0b000010000: return  5;
    case 0b000100000: return  6;
    case 0b001000000: return  7;
    case 0b010000000: return  8;
    case 0b100000000: return  9;
    case 0b111111111: return 10;
    default: return 11;
  }
};



///////////////////////////////////////////////////////////////////////////////
export class Sudoku {
  constructor(seed = Math.trunc(Math.random() * 1000000) + 1) {
    this.rand_x = 531829021;
    this.rand_y = 291032475;
    this.rand_z = 771890231;
    this.rand_w = seed;
    this.seed = seed;
  }
  next_int() {
    // xor shift: 負を返しうる
    const h = this.rand_x ^ (this.rand_x << 11);
    const w = this.rand_w;
    this.rand_x = this.rand_y;
    this.rand_y = this.rand_z;
    this.rand_z = w;
    return this.rand_w = (w ^ (w >>> 19)) ^ (h ^ (h >>> 8));
  }
  random(len) {
    return Math.abs(this.next_int()) % len;
  }
  *rand() {
    let dat = ANY;
    while (dat) {
      const bit = 1 << this.random(9);
      if (dat & bit) {
        dat &= ~bit;
        yield bit;
      }
    }
  }
  //////////////////////////////////////////////////////////////////////
  // 正解を作る
  create_ans() {
    const result = this.put_ans(new_board(), 0);
    if (result) {
      return result;
    } else {
      throw new Error('解答作りに失敗');
    }
  }
  // 答えを置いてみる
  put_ans(dat, pos) {
    if (pos >= 81) {
      for (let i = 0; i < 81; ++i) {
        if (!is_single(dat[i])) return null;
      }
      return dat;
    }
    const cur = dat[pos];
    if (cur == 0) return null;
    if (is_single(cur))
      return this.put_ans(dat, pos + 1);
    for (let bit of this.rand()) {
      if (bit & cur) {
        const tmp = [...dat];
        if (put_number(tmp, pos, bit)) {
          // 解けるか試す: 矛盾するかも
          if (solve(tmp)) { // 正しく解けた
            return tmp;
          }
          const ret = this.put_ans(tmp, pos + 1);
          if (ret) return ret;
        }
      }
    }
    return null;
  }
  //////////////////////////////////////////////////////////////////////
  // 問題を作る
  static CENTER = 0; // ＊
  static JOGE   = 1; // ÷
  static SAYU   = 2; // ・｜・
  static GKESA  = 3; // ＼
  static KESA   = 4; // ／
  static TYPE_MAX = 5;
  get_taisho(pos, type) {
    const x = pos % 9;
    const y = Math.trunc(pos / 9);
    switch (type) {
      case Sudoku.CENTER: return (8 - x) + ((8 - y) * 9);
      case Sudoku.JOGE: { // 真ん中のラインなら左右反転
        let p = x + ((8 - y) * 9);
        return p == pos? (8 - x) + (y * 9): p;
      }
      case Sudoku.SAYU: {
        let p = (8 - x) + (y * 9);
        return p == pos? x + ((8 - y) * 9): p;
      }
      case Sudoku.GKESA: {
        return x == y? ((x + 8) % 8 + (y + 8) % 8 * 9): (y + x * 9);
      }
      case Sudoku.KESA: {
        return x + y == 8? (y + x * 9): ((x + 8) % 8 + (y + 8) % 8 * 9);
      }
    }
  }
  open_duo(dat, que, ans, type, cnt = 7) {
    while (cnt) {
      const p1 = this.random(81);
      if (!is_single(dat[p1])) {
        const p2 = this.get_taisho(p1, type);
        // if (p2 < 0 || p2 >= 81) throw new Error('p2:' + p2 + ', p1:' + p1);
        if (que[p2] == ANY) { // 二個目はque
          que[p1] = ans[p1];
          put_number(dat, p1, ans[p1]);
          if (solve(dat)) return false;
          if (p1 != p2) { // ど真ん中ではない
            que[p2] = ans[p2];
            if (!is_single(dat[p2])) {
              put_number(dat, p2, ans[p2]);
              if (solve(dat)) return false;
            }
          }
          cnt -= 1;
        }
      }
    }
    // more?
    return true;
  }
  //////////////////////////////////////////////////////////////////////
  // 問題からヒントを減らす
  shuffle(lst) {
    let i = lst.length;
    while (i > 0) {
      const p = this.random(i--);
      [lst[i], lst[p]] = [lst[p], lst[i]];
    }
    return lst;
  }
  get_pos_list(que) {
    const lst = [];
    for (let i = 0; i < 81; ++i) {
      if (que[i] != ANY) lst.push(i);
    }
    return this.shuffle(lst);
  }
  slim(que, ignore = [], plst = this.get_pos_list(que)) {
    let best = [...ignore];
    for (let pos of plst) {
      if (ignore.includes(pos)) continue;
      // ヒントを減らしても解けるか
      const dat = new_board();
      for (let p of plst) {
        if (p != pos && !ignore.includes(p)) put_number(dat, p, que[p]);
      }
      if (solve(dat)) {
        const ig = [...ignore];
        ig.push(pos);
        const ret = this.slim(que, ig, plst);
        if (ret.length > best.length) {
          return ret;
        } else if (ig.length > best.length) {
          best = ig;
        }
      }
    }
    return best;
  }
  //////////////////////////////////////////////////////////////////////
  // 問題を変形する
  // q... {
  //   quest: array
  //   hint : ヒントの数
  //   ans  : array
  // }
  translate(q) {
    const num_list = [];
    for (let i = 1; i <= 9; ++i) {
      num_list.push({from: i, to: 0, count: 0});
    }
    const pos_list = [];
    for (let pos = 0; pos < 81; ++pos) {
      const cur = q.quest[pos];
      if (is_single(cur)) {
        const n = bit2num(cur) - 1;
        num_list[n].count += 1;
        pos_list.push(pos); // ヒント位置を記録
      }
    }
    // count最大が最初に来るようにする
    num_list.sort((a, b) => a.count == b.count? 0: a.count > b.count? -1: 1);
    for (let i = 0; i < 9; ++i) {
      num_list[i].to = 1 << i; // bit
    }
    // from(bit) 順で並びなおす
    num_list.sort((a, b) => a.from == b.from? 0: a.from < b.from? -1: 1);
    const result = {
      quest: new_board(),
      ans  : new_board(),
      hint : q.hint,
      lv   : q.lv,
    };
    // 問題を作る
    for (let pos of pos_list) {
      const id = bit2num( q.quest[ pos ] ); // 1 ~ 9
      // id - 1 == 元の数字の位置
      // to ... 変換後のbit
      result.quest[ pos ] = num_list[ id - 1 ].to;
    }
    // 答えを作る
    for (let i = 0; i < 81; ++i) {
      const id = bit2num( q.ans[ i ] ); // 1 ~ 9
      result.ans[ i ] = num_list[ id - 1 ].to;
    }
    return result;
  }
  //////////////////////////////////////////////////////////////////////
  // 問題を作る
  async create_quest() {
    const ans = this.create_ans();
    const dat = new_board();
    const que = new_board();
    const pattern = this.random(Sudoku.TYPE_MAX);
    // とりま問題を作って
    this.open_duo(dat, que, ans, pattern, 7); // 14hint
    while (this.open_duo(dat, que, ans, pattern, 1)); // other
    // ヒントを減らす
    const skip = this.slim(que);
    if (skip.length) {
      const slim = new_board();
      let hint = 0; // ヒント数を数える
      for (let i = 0; i < 81; ++i) {
        if (!skip.includes(i)) {
          slim[i] = que[i];
          if (que[i] != ANY) hint += 1;
        }
      }
      const level = solve_quest(slim); // レベルを算出: 1以上
      if (level) { // 解ける
        // ９などの大きな数をを隠して返す
        return this.translate({
          quest: slim,
          ans  : ans,
          hint : hint, // count
          lv: level,
        });
      } else {
        throw new Error("解けない問題を出力(1): " + this.seed);
      }
    } else {
      // ヒント削減に失敗: 元の問題そのままを表示
      console.log('sippai');
      let hint = 0;
      for (let i = 0; i < 81; ++i) {
        if (que[i] != ANY) hint += 1;
      }
      const level = solve_quest(que);
      if (level) {
        return this.translate({
          quest: que,
          ans:   ans,
          hint: hint,
          lv:  level,
        });
      } else {
        throw new Error("解けない問題を出力(2): " + this.seed);
      }
    }
  }
}

