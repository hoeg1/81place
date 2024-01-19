import { NumberPlace } from "./NumberPlace.js";

// 問題を生成する
function test1() {
//http://localhost:8000/?id=N658CE20P29
  const seed = 0x658CE20;//Math.trunc(Math.random() * 10000) + 1;
  const np = new NumberPlace(seed);
  const moto = np.create_quest(29);//32);
  const q = NumberPlace.translate(moto);
  NumberPlace.print(q.ans);
  NumberPlace.print(q.quest);
  console.log('hint:', q.hint, ' seed:', seed);
  const ret = NumberPlace.solve_quest(q.quest);
  if (ret.ok) {
    let flag = true;
    for (let i = 0; i < 81; ++i) {
      if (ret.solved[i] != q.ans[i]) {
        console.log(`答えが違う: at ${i}, solve = ${ret.solved[i]}, ans = ${q.ans[i]}`);
        flag = false;
        break;
      }
    }
    if (flag) console.log('正しく解けた');
  } else {
    console.log('解けない');
  }
}

// 文字列からロードして解く
function test2() {
const mondai = [
  { ans: "\
 5  3  9    2  1  4    8  6  7 \
 7  4  8    3  6  5    9  2  1 \
 2  1  6    9  8  7    3  5  4 \
\
 8  2  3    1  4  9    6  7  5 \
 4  9  5    6  7  3    2  1  8 \
 1  6  7    8  5  2    4  3  9 \
\
 6  7  2    5  9  8    1  4  3 \
 9  5  1    4  3  6    7  8  2 \
 3  8  4    7  2  1    5  9  6 \
    ",
  que: "\
    .39 2.. .6. \
    7.8 ..5 9.1 \
    2.. ... ..4 \
    \
    ... 1.9 .7. \
    4.. 6.3 218 \
    1.7 85. 43. \
    \
    672 ... 14. \
    95. .36 782 \
    384 .2. 596" },
  {que: "\
  ..2 ... ..8 \
  634 .9. ... \
  ... .76 2.. \
  \
  ... ... .9. \
  8.. 7.. ... \
  17. .8. 5.. \
  ... 8.. ..3 \
  .29 ... ..1 \
  41. .3. ... ",
  ans: "\
  752 341 968 \
  634 298 175 \
  981 576 234 \
  \
  243 165 897 \
  895 724 316 \
  176 983 542 \
  \
  567 819 423 \
  329 457 681 \
  418 632 759"},
  {ans:"\
 3  1  4 | 2  7  8 | 6  5  9 \
 6  8  9 | 4  3  5 | 2  7  1 \
 2  7  5 | 9  6  1 | 8  4  3 \
 5  3  8 | 7  4  2 | 9  1  6 \
 7  2  6 | 8  1  9 | 4  3  5 \
 4  9  1 | 6  5  3 | 7  2  8 \
 8  4  3 | 1  2  6 | 5  9  7 \
 1  6  7 | 5  9  4 | 3  8  2 \
 9  5  2 | 3  8  7 | 1  6  4 ",
    que:"\
_  _  4 | _  _  _ | _  _  9 \
_  8  _ | _  3  5 | 2  _  1 \
2  7  _ | 9  _  _ | _  _  _ \
_  3  _ | _  4  2 | _  _  6 \
7  _  _ | _  _  _ | _  3  _ \
_  _  _ | _  _  3 | _  2  8 \
_  4  _ | 1  _  6 | 5  _  _ \
_  6  _ | _  9  _ | 3  _  _ \
_  _  2 | 3  _  7 | 1  _  _ "},
];
  const np = new NumberPlace();
  const sel = 1;
  const que = NumberPlace.load_quest(mondai[sel].que, true); // use_put
  NumberPlace.print(que); // とりまputしたところまで
  NumberPlace.solve(que); // 解く
  let flag = true;
  const ans = NumberPlace.load_quest(mondai[sel].ans, false);
  for (let i = 0; i < 81; ++i) {
    if (que[i] != ans[i]) {
      console.log(`err: i = ${i}, ${que[i]} != ${ans[i]}`);
      flag = false;
    }
  }
  if (flag) {
    console.log('解けた。ansと同じ');
    NumberPlace.print(que); // 結果
  }
}


// Game id を解釈
function test3() {
  const str1 = 'N89aFcDP32';
  // ok
  console.log(`done: '${str1}' is`, NumberPlace.id_to_seed_object(str1));
  // ng 1
  const str2 = 'N8x58P32';
  try {
    console.log(str2, 'is', NumberPlace.id_to_seed_object(str2));
  } catch (e) {
    console.log('err:', e.message);
  }
  // ng 2
  const str3 = 'N8c58P88';
  try {
    console.log(str3, 'is', NumberPlace.id_to_seed_object(str3));
  } catch (e) {
    console.log('err:', e.message);
  }
}

function score_test() {
  let cnt = 81;
  let sum = 0;
  for (let i = 9; i >= 1; --i) {
    for (let j = 0; j < 9; ++j) {
      const pt = cnt * i;
      sum += pt;
      console.log(`${String(cnt).padStart(2, '0')}: ${pt}`);
      cnt -= 1;
    }
  }
  console.log('sum = ' + sum);
}

function score_test2() {
  let cnt = 81;
  let sum = 0;
  for (let i = 9; i >= 1; --i) {
    for (let j = 0; j < 9; ++j) {
      const pt = cnt * i * i;
      sum += pt;
      console.log(`${String(cnt).padStart(2, '0')}: ${pt}`);
      cnt -= 1;
    }
  }
  // 153,765
  console.log('sum = ' + sum);
}

function score_test3(k = 2) {
  let cnt = 81;
  let sum = 0;
  for (let i = 9; i >= 1; --i) {
    for (let j = 0; j < 9; ++j) {
      const pt = cnt * i * k;
      sum += pt;
      console.log(`${String(cnt).padStart(2, '0')}: ${pt}`);
      cnt -= 1;
    }
  }
  // 42,930
  console.log('sum = ' + sum);
}

function score_test4() {
  let cnt = 81;
  let sum = 0;
  for (let n = 9; n >= 1; --n) {
    let nsum = 0;
    for (let k = 0; k < 9; ++k) {
      const pt = cnt * (n * (n + 1) / 2);
      sum += pt;
      nsum += pt;
      cnt -= 1;
    }
    console.log(`${n}: ${nsum}`);
  }
  console.log('-----------');
  const best = sum;
  //
  cnt = 81;
  sum = 0;
  for (let n = 1; n <= 9; ++n) {
    let nsum = 0;
    for (let k = 0; k < 9; ++k) {
      const pt = cnt * (n * (n + 1) / 2);
      sum += pt;
      nsum += pt;
      cnt -= 1;
    }
    console.log(`${n}: ${nsum}`);
  }
  console.log('-----------');
  console.log('best:', best);     // 87,615
  console.log('worst:', sum);     // 34,155
  console.log('sa:', best - sum); // 53,460
  // 1h  = 3,600,000ms
  // 10m =   600,000ms
  // 30m = 1,800,000ms
  // 999s = 16.65m
}

/////////////////////////////////////////////////////////////////////////
//test1();
score_test4();
//console.log( NumberPlace.is_illegal_hint(5) );
