import { NumberPlace } from './NumberPlace.js';

self.onmessage = (e) => {
  if (e.data.type == 'solve') {
    try {
      const ans = NumberPlace.load_quest(e.data.quest_str, true); // use_put
      const ok = NumberPlace.solve(ans)
      postMessage({
        state: ok,
        msg: (ok? '解けました': 'このソルバでは解けませんでした'),
        result: ans, // !ok なら途中経過
      });
    } catch (e) {
      postMessage({ state: false,  msg: e.message });
    }
  } else if (e.data.type == 'create') {
    const id    = NumberPlace.id_to_seed_object(e.data.game_id);
    const np    = new NumberPlace(id.seed);
    const orig  = np.create_quest(id.hint);
    const trans = NumberPlace.translate(orig);
    postMessage({
      state: true,
      msg: '',
      result: trans,
    });
  } else {
    postMessage({ state: false, msg: `謎のシグナル: ${e.data.type}` });
  }
};


