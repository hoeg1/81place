
export class NumberPlace {
  static ANY = 0b111111111; // 9bit
  static HINT_LOW = 25;
  static is_illegal_hint(lv) {
    return isNaN(lv) || lv < this.HINT_LOW || lv >= 81;
  }
  static create_id_str(seed, hint) {
    if (this.is_illegal_hint(hint)) {
      throw new Error(`${hint} は計算できないヒント数です`);
    }
    return 'N' + (seed | 0).toString(16).toUpperCase() + 'P' + (hint | 0);
  }
  static id_to_seed_object(id_str) {
    if (/N[0-9a-fA-F]+P[1-8][0-9]/.test(id_str)) {
      const ary = id_str.split(/[NP]/);
      const hint = parseInt(ary[2]);
      if (this.is_illegal_hint(hint)) {
        throw new Error(`指定されたヒント数 ${hint} はサポートしていません。`);
      }
      return {
        seed: parseInt(ary[1], 16),
        hint: hint,
      };
    } else {
      console.log('id_to_seed_object:',id_str);
      throw new Error(`ゲームID '${id_str}' を解釈できません。`);
    }
    return '';
  }
  constructor(seed = 1573921351) {
    this.rand_x = 531829021;
    this.rand_y = 291032475;
    this.rand_z = 771890231;
    this.rand_w = seed;
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
  // ボックスとタテヨコをサーチ
  static XPOS = 0;
  static YPOS = 1;
  static ROOM = 2;
  static cross_box(pos, call_back) {
    const [x, y] = this.p2xy(pos);
    const xstart = y * 9;
    //const ystart = x;
    const bx = x - (x % 3);
    const by = y - (y % 3);
    const bstart = bx + by * 9;
    for (let i = 0, bstep = 0; i < 9; ++i) {
      const tx = xstart + i;
      if (tx != pos) call_back(tx, this.XPOS);
      const ty = x + i * 9;
      if (ty != pos) call_back(ty,  this.YPOS);
      const i3 = i % 3;
      const bp = bstart + bstep + i3;
      if (bp != pos) call_back(bp, this.ROOM);
      if (i3 == 2) bstep += 9;
    }
  }
  // 重複なしでサーチ
  static once(pos, call_back) {
    const ig = new Set();
    ig.add(pos);
    this.cross_box(pos, (p) => {
      if (!ig.has(p)) {
        ig.add(p);
        call_back(p);
      }
    });
  }
  // ビットがひとつだけ立っているか
  static is_single(bit) {
    return bit != 0 && (bit & -bit) == bit;
  }
  static popcount(x) {
    const a = x - (x >>> 1 & 0x55555555);
    const b = (a & 0x33333333) + (a >>> 2 & 0x33333333);
    const c = b + (b >>> 4) & 0x0f0f0f0f;
    const y = c * 0x01010101 >>> 24;
    return y;
  }
  static ntz(x) {
    return this.popcount( (x & -x) - 1 );
  }
  // 0 ~ len までの数字を１つずつランダムな順で返す。３０まで
  *rand(len = 9) {
    if (len > 30) throw new Error('len = ' + len);
    let dat = (1 << len) - 1;
    while (dat) {
      const pos = this.random(len);
      const bit = 1 << pos;
      if (dat & bit) {
        dat &= ~bit;
        yield pos;
      }
    }
  }
  // ANY で埋めた配列を返す
  static any_ary() {
    return new Array(81).fill(this.ANY);
  }
  // 座標
  static p2xy(pos) {
    return [pos % 9, Math.trunc(pos / 9)];
  }
  static xy2p(x, y) {
    return x + y * 9;
  }
  // データを適当な数値にする
  static bit2num(x) {
    return this.is_single(x)? this.ntz(x) + 1:
      x == 0? 0:
      x == this.ANY? 10:
      11;
  }
  // 数字をひとつ置いて排他処理する
  // 結果確定したマスがあればそこも排他処理する
  static put(target, pos, bit) {
    target[pos] = bit;
    this.once(pos, (p) => {
      if (target[p] & bit) {
        target[p] &= ~bit;
        const cur = target[p];
        if (cur == 0) {
          throw new Error('zero');
        } else if (this.is_single(cur)) {
          this.put(target, p, cur);
        }
      }
    });
  }
  // 正解盤面を作って返す
  create_ans(ans, pos = 0) { // random
    if (pos >= 81) {
      for (let i = 0; i < 81; ++i)
        if (!NumberPlace.is_single(ans[i])) return null;
      return ans;
    }
    const data = ans[pos];
    if (data == 0) return null;
    if (NumberPlace.is_single(data))
      return this.create_ans(ans, pos + 1);
    //
    for (let rnd of this.rand()) {
      const bit = 1 << rnd;
      if (data & bit) {
        const tmp = [...ans];
        try {
          NumberPlace.put(tmp, pos, bit);
          const ret = this.create_ans(tmp, pos + 1);
          if (ret) return ret;
        } catch(e) { }
      }
    }
    return false;
  }
  // 矛盾が無いか調べる
  static mujun_check(data, skip_zero = false) {
    for (let i = 0; i < 81; ++i) {
      const cur = data[i];
      if (skip_zero && cur == this.ANY) continue;
      this.once(i, (p) => {
        if (cur == data[p])
          throw new Error(`矛盾している。i = ${i}, p = ${p}`);
        if (!this.is_single(cur))
          throw new Error('異常なデータ。位置: ' + i);
      });
    }
  }

  // 盤面データを読み込んで配列にする
  // 0 or . or _ ... 不明なマス
  // 1~9         ... ヒント
  // それ以外    ... 無視 => print の出力をママで使える
  static load_quest(str, use_put = true) {
    const ret  = this.any_ary();
    const test = this.any_ary();
    let cnt = 0;
    for (let i = 0; i < str.length; ++i) {
      const ch = str.charAt(i);
      if (/[._0-9]/.test(ch)) {
        // 0, ., _ はすでに代入されてるからスキップ
        if (/[1-9]/.test(ch)) {
          const bit = 1 << (parseInt(ch) - 1);
          test[cnt] = bit;
          if (use_put) {
            this.put(ret, cnt, bit);
          } else {
            ret[cnt] = bit;
          }
        }
        cnt += 1;
      }
    }
    if (cnt != 81) throw new Error('load: cnt = ' + cnt);
    // ヒントに矛盾が無いか調べる
    this.mujun_check(test, true);
    return ret;
  }

  // 問題をxorで解く
  // 他の手筋は使わない
  // 答えを見ずにヒントだけから推論しているので
  // 盤面が埋まればそれが唯一解のはず
  static solve(que) {
    let loop_flag = true;
    while (loop_flag) {
      loop_flag = false;
      let s_cnt = 0;
      for (let pos = 0; pos < 81; ++pos) {
        const cur = que[pos];
        if (this.is_single(cur)) {
          s_cnt += 1;
          if (s_cnt == 81) return true;
          continue;
        }
        let xflag = 0;
        let yflag = 0;
        let bflag = 0;
        this.cross_box(pos, (p, ty) => {
          switch (ty) {
            case this.XPOS: xflag |= que[p]; break;
            case this.YPOS: yflag |= que[p]; break;
            case this.ROOM: bflag |= que[p]; break;
            default: throw new Error('unknown type: ' + ty);
          }
        });
        if (this.is_single((xflag ^ cur) & cur)) {
          this.put(que, pos, (xflag ^ cur) & cur);
          loop_flag = true;
        } else if (this.is_single((yflag ^ cur) & cur)) {
          this.put(que, pos, (yflag ^ cur) & cur);
          loop_flag = true;
        } else if (this.is_single((bflag ^ cur) & cur)) {
          this.put(que, pos, (bflag ^ cur) & cur);
          loop_flag = true;
        }
      }
    } // end while
    return false;
  }
  // load_quest等で読み込んだ問題： ヒントは１ビットで、空白はANYな問題を解く
  static solve_quest(quest) {
    const que = this.any_ary();
    for (let i = 0; i < 81; ++i) {
      if (this.is_single(quest[i])) {
        this.put(que, i, quest[i]);
      }
    }
    const ok = this.solve(que);
    return {
      ok: ok,      // 解けたか
      solved: que, // 解いた結果
    };
  }

  // タテヨコボックスにbitがあるか調べる
  static find_same(data, pos, bit) {
    let hit = false;
    this.cross_box(pos, (p) => {
      if (data[p] == bit) hit = true;
    });
    return hit;
  }

  // 問題をつくる
  // lv => ヒントの最大値。15より小, または81以上は不正
  //       大きいほど早く答えを出せる: 小さいと遅え
  //       28, 30, 32 くらいが妥当か
  // return = {
  //   ans:   正解の配列,
  //   quest: ヒントとして表示する配列,
  //   hint:  ヒントの数
  // };
  create_quest(lv = 28) { // random
    if (NumberPlace.is_illegal_hint(lv)) throw new Error('lv = ' + lv);
    // 答えを作る
    const ans = this.create_ans(NumberPlace.any_ary());
    // 答えを元に問題を作る
    while (true) {
       // ヒントに使った数
      let hint_cnt = 0;
      // que ... 解けるか試すための配列
      const que   = NumberPlace.any_ary();
      // quest ... ヒントとして公開する配列
      const quest = NumberPlace.any_ary();
      /* 探索する */
      let hint_flag = true; // ヒントを追加する余地があるなら真
      // 適当な数字をひとつヒントとして公開する関数
      const used = new Set();
      for (let i = 0; i < 81; ++i) {
        used.add(i); // まだヒントに使ってない場所
      }
      const rnd_set = () => {
        if (used.size == 0) {
          // もうどこにもヒントを置けない = 解いてる
          hint_flag = false;
          return;
        }
        const lst = new Array(10).fill([]);
        used.forEach((i) => {
          lst[ NumberPlace.popcount(que[i]) - 1 ].push(i);
        });
        // 1 bit なマスは確定してるから最後にまわす
        lst[10] = lst[0];
        for (let i = 1; i <= 9; ++i) {
          // 可能性を絞れるほうが有効らしい
          if (lst[i].length) {
            const idx = this.random(lst[i].length);
            const pos = lst[i][idx];
            NumberPlace.put(que, pos, ans[pos]);
            quest[pos] = ans[pos];
            used.delete(pos);
            hint_cnt++;
            return;
          }
        }
        // もうどこにもヒントを置けない = 解いてる
        hint_flag = false;
      };
      // 最初に、最低でも１４マスのヒントを用意する
      for (let i = 0; hint_flag && i < 14; ++i) {
        rnd_set();
      }
      // ヒントで解けるかを試す
      while (hint_cnt < lv && hint_flag && !NumberPlace.solve(que)) {
        // 解けないならヒントを追加
        rnd_set();
      }
      // ヒントの数が lv より小さいなら確定
      if (hint_cnt < lv){
        // ほんとにコレが唯一解？ // TODO: この判定は必要ないかも
        // ランダムに配られたヒントから”うっかり”すべて埋まっただけかも
        // ans は最初に作っているし確定なので、
        let is_uniq = true;
        for (let i = 0; i < 81; ++i) {
          if (que[i] != ans[i]) {
            is_uniq = false; // 別解がある
            break;
          }
        }
        if (is_uniq) { // 無いなら合理的に導ける唯一の解として良いはず
          return {
            ans: ans,
            quest: quest,
            hint: hint_cnt,
          };
        } else {
          throw new Error('ありえた');
        }
      }
      // 答えは同じで問題を作り直す
    } // end while(true)
  }

  // create_ans の結果を変形する
  // ヒントのうち最も多い数字をリストし、
  // ヒントが多い数字ほど小さい数字になるように修正する
  // 9などはなるたけ最後に解けるようにしたい
  static translate(q) {
    const num_list = [];
    for (let i = 1; i <= 9; ++i) {
      num_list.push({from: i, to: 0, count: 0});
    }
    const pos_list = [];
    for (let pos = 0; pos < 81; ++pos) {
      const cur = q.quest[pos];
      if (this.is_single(cur)) {
        const n = this.bit2num(cur) - 1;
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
      quest: this.any_ary(),
      ans  : this.any_ary(),
      hint : q.hint,
    };
    // 問題を作る
    for (let pos of pos_list) {
      const id = this.bit2num( q.quest[ pos ] ); // 1 ~ 9
      // id - 1 == 元の数字の位置
      // to ... 変換後のbit
      result.quest[ pos ] = num_list[ id - 1 ].to;
    }
    // 答えを作る
    for (let i = 0; i < 81; ++i) {
      const id = this.bit2num( q.ans[ i ] ); // 1 ~ 9
      result.ans[ i ] = num_list[ id - 1 ].to;
    }
    return result;
  }

  /////////////////////////////////////////////////////////////////////////////
  static print_bin(data) {
    for (let y = 0; y < 9; ++y) {
      let str = '';
      for (let x = 0; x < 9; ++x) {
        const pos = this.xy2p(x, y);
        str += ('000000000' + data[ pos ].toString(2)).slice(-9);
        str += x != 8? (x % 3 == 2? ',   ': ', '): ',';
      }
      console.log(str);
      if (y % 3 == 2) console.log();
    }
  }
  static print(data, now_print = true) {
    const BAR = '+---------+---------+---------+';
    if (now_print) console.log(BAR);
    let result = BAR + '\n';
    for (let y = 0; y < 9; ++y) {
      let str = '|';
      for (let x = 0; x < 9; ++x) {
        const pos = this.xy2p(x, y);
        const n = this.bit2num(data[pos]);
        str += ' ' + (n == 10? '_': n == 11? '.': n.toString()) + ' ';
        if (x % 3 == 2) str += '|';
      }
      if (now_print) console.log(str);
      result += str + '\n';
      if (y % 3 == 2) {
        if (now_print) console.log(BAR);
        result += BAR + '\n';
      }
    }
    return result;
  }
} // end class



