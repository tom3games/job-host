// 音の割り当て（全部録音素材。出所は CREDITS.md）。game.js はここの Sfx(n) と ambOn を呼ぶ
(() => {
  const KEY = 'jh_mute'
  try { Snd.muted = localStorage.getItem(KEY) === '1' } catch (e) {}
  const setM = Snd.setMute
  Snd.setMute = function (m) { setM.call(this, m); try { localStorage.setItem(KEY, m ? '1' : '0') } catch (e) {} }
  Snd.def({
    card: ['snd/card1.mp3', 'snd/card2.mp3'], clink: ['snd/clink1.mp3', 'snd/clink2.mp3', 'snd/clink3.mp3'], cork: 'snd/cork.mp3', pour: 'snd/pour.mp3',
    step: ['snd/step1.mp3', 'snd/step2.mp3'], tap: 'snd/tap.mp3', win: 'snd/win.mp3', win2: 'snd/win2.mp3', lose: 'snd/lose.mp3',
    stamp: 'snd/stamp1.mp3', siren: 'snd/siren.mp3', coins: 'snd/coins.mp3', thwack: 'snd/thwack.mp3', applause: 'snd/applause.mp3',
  })
  const CUE = {
    card: [['card', { vol: 0.5 }]], good: [['clink', { vol: 0.5 }]], bad: [['thwack', { vol: 0.35, rate: 1.1 }]], tap: [['tap', { vol: 0.5, jitter: 0 }]],
    sold: [['cork', { vol: 1, room: 0.4 }], ['pour', { vol: 0.6, delay: 0.5 }], ['coins', { vol: 0.5, delay: 0.3 }]],
    run: [0, 0.14, 0.28, 0.42, 0.56].map(d => ['step', { vol: 0.7, delay: d }]), siren: [['siren', { vol: 0.5, room: 0.4 }]],
    stamp: [['stamp', { vol: 1 }], ['thwack', { vol: 0.7, rate: 0.7 }]], win: [['win', { vol: 0.8 }]], win2: [['win2', { vol: 0.8 }]], lose: [['lose', { vol: 0.8 }]], coins: [['coins', { vol: 0.6 }]],
  }
  let clap = null
  window.Sfx = function (n) { Snd.played[n] = (Snd.played[n] || 0) + 1; for (const [k, o] of CUE[n] || []) Snd.play(k, o) }
  // シャンパンコールの間だけ店全体が盛り上がる（拍手と歓声）
  window.Hype = function (on) {
    Snd.played[on ? 'hypeOn' : 'hypeOff'] = (Snd.played[on ? 'hypeOn' : 'hypeOff'] || 0) + 1
    if (clap) { try { clap.stop() } catch (e) {} clap = null }
    if (on) { clap = Snd.play('applause', { vol: 0.9, jitter: 0, room: 0.2 }); Snd.loop('amb', 'snd/crowd.mp3', 0.55, 0.25); Snd.duck(0.75, 4) }
    else Snd.loop('amb', 'snd/crowd.mp3', 0.1, 0.8)
  }
  // 環境音: 客のざわめき＋壁越しのクラブの低音
  window.ambOn = function () { if (Snd._amb) { Snd.init(); return } Snd._amb = 1; Snd.init(); Snd.loop('amb', 'snd/crowd.mp3', 0.1, 1); Snd.loop('bed', 'snd/club.mp3', 0.28, 1) }
})()
