import { is_single, cross_box, new_board, put_number, bit2num, XPOS, YPOS, ROOM } from './sudoku.js';

const xy = (pos) => `(${pos % 9 + 1}, ${Math.trunc(pos / 9) + 1})`;

const put = (dat, pos, bit, list) => {
  dat[pos] = bit;
  cross_box(pos, (p, _) => {
    if (dat[p] & bit) {
      dat[p] &= ~bit;
      const cur = dat[p];
      if (cur == 0) {
        throw new Error(`${xy(p)} に入る数字がありません。`);
      }
      if (is_single(cur)) {
        list.push({ pos: p, num: bit2num(cur) });
      }
    }
  });
};


const xor_solver = (dat, lst) => {
  for (let pos = 0; pos < 81; ++pos) {
    const cur = dat[pos];
    if (is_single(cur)) continue;
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
      lst.push({ pos: pos, num: bit2num(x), kind: 'x' });
    } else if (is_single(y)) {
      lst.push({ pos: pos, num: bit2num(y), kind: 'y' });
    } else if (is_single(b)) {
      lst.push({ pos: pos, num: bit2num(b), kind: 'b' });
    }
  }
};

const put_test = (cur_quest) => {
  const dat = [...cur_quest];
  const lst = [];
  for (let i = 0; i < 81; ++i) {
    if (is_single(cur_quest[i])) {
      put(dat, i, cur_quest[i], lst);
    }
  }
  return lst;
};

const xor_test = (cur_quest) => {
  const dat = new_board();
  // 再帰を許して置き尽くす
  for (let i = 0; i < 81; ++i) {
    if (is_single(cur_quest[i])) {
      put_number(dat, i, cur_quest[i]);
    }
  }
  const lst = [];
  xor_solver(dat, lst);
  return lst;
};

export const create_dialog = () => {
  const dialog = document.createElement('dialog');
  dialog.setAttribute('class', 'cheat_dialog');
  dialog.setAttribute('id', 'cheat_box');
  const table = document.createElement('table');
  let cnt = 0;
  for (let y = 0; y < 9; ++y) {
    const tr = document.createElement('tr');
    for (let x = 0; x < 9; ++x) {
      const td = document.createElement('td');
      td.setAttribute('id', `cheat-${cnt}`);
      if ( ((x < 3 || x > 5) && y >= 3 && y <= 5) ||
           ((y < 3 || y > 5) && x >= 3 && x <= 5) ) {
        td.setAttribute('class', `cheat_gray`);
      }
      tr.appendChild(td);
      cnt += 1;
    }
    table.appendChild(tr);
  }
  dialog.appendChild(table);
  //
  const msg = document.createElement('p');
  msg.setAttribute('id', 'cheat-msg');
  dialog.appendChild(msg);
  //
  const close = document.createElement('button');
  close.textContent = 'OK';
  close.addEventListener('click', (e) => {
    dialog.close();
  });
  dialog.appendChild(close);
  //
  document.body.appendChild(dialog);
};

const set_number = (dat, hint, msg) => {
  for (let pos = 0; pos < 81; ++pos) {
    const tar = document.getElementById(`cheat-${pos}`);
    const cur = dat[pos];
    if (tar.classList.contains('this_is_cheat')) {
      tar.classList.remove('this_is_cheat');
    }
    if (hint.pos == pos) {
      tar.textContent = hint.num;
      tar.classList.add('this_is_cheat');
    } else if (is_single(cur)) {
      tar.textContent = bit2num(cur);
    } else {
      tar.textContent = '';
    }
  }
  document.getElementById('cheat-msg').textContent = msg;
  document.getElementById('cheat_box').showModal();
};

const mujun_check = (cur_que, lst) => {
  for (let l of lst) {
    if (is_single(cur_que[l.pos])) {
      console.log(lst);
      throw new Error(`プログラムエラー: pos: ${l.pos}, num: ${l.num}`);
    }
  }
};

export const get_hint = (cur_quest) => {
  try {
    const lst = put_test(cur_quest);
    if (lst.length) {
      mujun_check(cur_quest, lst);
      lst.sort((a, b) => a.num - b.num);
      const hint = lst[0];
      set_number(cur_quest, hint,
        `数字の効きに注目すると、${xy(hint.pos)} には必ず ${hint.num} が入るとわかります。`);
    } else {
      const lst2 = xor_test(cur_quest);
      if (lst2.length) {
        mujun_check(cur_quest, lst2);
        lst2.sort((a, b) => a.num - b.num);
        const hint = lst2[0];
        const msg = hint.kind == 'x'?
          `${Math.trunc(hint.pos / 9) + 1} 行目に注目すると、`
          : hint.kind == 'y'?
          `${hint.pos % 9 + 1} 列目に注目すると、`
          : '各部屋に注目すると、'
        set_number(cur_quest, hint,
          msg + `${xy(hint.pos)} には必ず ${hint.num} が入るとわかります。`);
      } else {
        throw new Error('答えを導けません。書き込んだ数字のどこかを間違えています');
      }
    }
  } catch (e) {
    console.log(e);
    alert(e.message);
  }
};


// http://localhost:8000/?id=S4EEDCFE
