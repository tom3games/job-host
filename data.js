// 一晩だけホスト: UI の文言・ボトル・共通の台詞（日英）。客ごとの会話は talk.js、処理は game.js
window.HD = (() => {
  const t = (ja, en) => ({ ja, en })
  // 態度。言葉でなく、しぐさで今の気持ちを見せる（しぐさの無い一歩で出す）
  const ATT = {
    low: [t('スマホを見始めた', 'Starts checking a phone'), t('時計をちらっと見た', 'Glances at the clock')],
    mid: [t('グラスを両手で持っている', 'Holds the glass in both hands'), t('脚を組み替えた', 'Shifts on the sofa')],
    warm: [t('グラスをこちらに向けた', 'Turns the glass your way'), t('椅子に深く座り直した', 'Settles back into the sofa')],
    lean: [t('身を乗り出してきた', 'Leaning in now'), t('自分から話し始めた', 'Starts talking unprompted')],
    full: [t('目を見て笑っている', 'Meets your eyes, laughing'), t('肩を叩いて笑っている', 'Taps your shoulder, laughing')],
  }
  // 財布。卓に置いた物で分かる。普通の財布の人は何も置かない
  const WALLET = {
    rich: { yen: 1500000, i: 'cards', ...t('カードを4枚並べた', 'Four cards laid out') },
    mid: { yen: 450000 },
    poor: { yen: 150000, i: 'coupons', ...t('クーポンの束を数えている', 'Counting a stack of coupons') },
  }
  // 共通の台詞（客ごとの lines が無い時に使う）
  const LINE = {
    buy: [t('よし、開けちゃおう', 'Fine, open it'), t('今日は特別ね', 'Tonight is special')],
    last: t('今日はここまでね', 'That is it for tonight'),
    over: t('財布、見えてる？', 'Have you seen my purse?'),
    early: t('楽しくなる前に言う？', 'Before I even had fun?'),
    early2: t('押し売りなら帰るね', 'Hard sell? I am leaving'),
    silent: [t('……起きてる？', '...You awake?'), t('なんか言ってよ', 'Say something')],
    bored: t('それ、さっきも聞いた', 'Heard that one already'),
    good: t('また来る。次も君で', 'I will be back. You again'),
    ok: t('ごちそうさま', 'Thanks for the drink'),
    bad: t('帰るね', 'I am leaving'),
    afterStop: t('……今の、何？', '...What was that?'),
  }
  // ボトル。安い順に1本ずつしか勧められない。上の段ほど楽しませてからでないと押し売りになる
  const BOTTLE = [
    { i: 'b1', yen: 30000, need: 45, n: t('シャンパーニュ・ド・ピカピカ', 'Champagne de Pikapika') },
    { i: 'b2', yen: 100000, need: 60, n: t('ロゼ・ド・チカチカ', 'Rose de Chikachika') },
    { i: 'b3', yen: 300000, need: 75, n: t('ゴールド・ド・ギラギラ', 'Or de Giragira') },
    { i: 'tower', yen: 1000000, need: 90, n: t('シャンパンタワー', 'Champagne tower') },
  ]
  // シャンパンコール。一気飲みの煽りは書かない。客を全肯定するだけ
  const CALL = {
    open: [t('シャンパン\n入りました！', 'Champagne,\neverybody!')],
    mid: [t('{n}に感謝！', 'Thank you, {n}!'), t('今日も生きてて\nえらい！', 'You survived\ntoday!'), t('確定申告\nばっちり！', 'Your taxes\nare flawless!'), t('お肌つやつや！', 'Your skin is glowing!'), t('歯医者も行けて\nえらい！', 'You went to\nthe dentist!'), t('洗濯物も\n取り込んだ！', 'You brought in\nthe laundry!'), t('上司より\n徳が高い！', 'More virtue\nthan your boss!'), t('家賃、期限内！', 'Rent paid on time!'), t('朝ごはんも食べた！', 'You ate breakfast!'), t('まばたきが上手！', 'Elite blinking!')],
    last: [t('ありがとう\nございました！', 'Thank you\nvery much!')],
    tower: [t('タワー\nいきます！', 'Tower\ntime!'), t('新人、\nよく働いた！', 'The rookie\ndid it!'), t('今夜は\n全員えらい！', 'Everyone was\ngreat tonight!')],
  }

  const UI = {
    ja: {
      series: '1日だけ職場体験 #5', title: '一晩だけホスト', sub: '1人の客に、いくら使わせる？', start: '入店する', howto: '遊び方', close: '閉じる', load: 'グラスを磨いています', privacy: 'プライバシーについて',
      how: ['今夜は客1人に付きっきり。帰るまでにいくら使ってもらえるか', '客の一言に3択で返す。卓の持ち物と、しぐさの一行が本音', '誰にでも言える言葉は弱い。その人の細部を拾い、答えは深掘り', '身を乗り出したらボトル。安い順に1本ずつ、上ほど高い', '早すぎる勧めは押し売り。2回で帰る。財布の中身も見ておく', '滑っても1回は挽回できる。同じ持ちネタは2回言わない', '色恋とツケは店ごと止まる'],
      legal: 'このゲームは風刺です。実在の店や人物とは関係ありません。お酒は20歳になってから。',
      boss: '店長', naikin: '内勤',
      intro: ['体験の新人か。今夜は1人だけ付け', '持ち物としぐさが本音だ。よく見ろ', '楽しませてからボトル。安いのから順に'], next: 'つぎへ', skip: 'とばす',
      tut: { bottle: '身を乗り出した。勧めどきだ' },
      bottle: 'ボトルを勧める', menu: 'ドリンクメニュー', back: 'もどる', ura: '先輩の落書き', love: '俺の彼女になってよ', tsuke: '今夜はツケでいいよ',
      loveYen: 1000000, tsukeYen: 1500000, idcheck: '先に身分証を見せてもらう', sold: '済', locked: '安い順に1本ずつ',
      stopLove: 'それ、店ごと止まります！', stopTsuke: 'うちはツケやめたんです！', stopFine: '始末書', stopOk: 'すみません',
      raidLove: '恋愛感情につけ込む営業は営業停止の対象。2025年の法改正です', raidTsuke: 'ツケで客を追い込む店だと通報が入りました', raidMinor: '未成年に酒を出しました', raidTax: 'その帳簿、全部書いてました', raidStamp: '営業停止', toSlip: '給料明細へ',
      minorSent: '内勤が家まで送ります', nomiFee: '指名料', spent: n => `${n}の会計`, bottlesHud: n => `ボトル ${n}本`, again: 'もう一回', toTitle: 'タイトル', save: '画像を保存', post: 'Xでポスト',
      job: 'ホストクラブ', name: '体験ホスト　様', footer: 'tom3games.github.io/job-host',
      payComm: '売上歩合', payNomi: '指名手当', payBottle: 'シャンパン手当', payMinor: '見抜き手当', dedWarn: '始末書', dedRaid: '営業停止の損害', unitN: '本', unitT: '回', unitP: '人', note: (who, a) => `${who}の会計¥${a.toLocaleString()}の20%`,
      ranks: { raid: '営業\n停止', catch: '見抜\nいた', zero: 'クビ', low: '見習い', mid: '合格', top: '今夜\n1番', legend: '伝説' }, rankName: { raid: '営業停止', catch: '見抜いた新人', zero: 'クビ', low: '見習い', mid: '合格', top: '今夜の1番', legend: '伝説の新人' },
      comments: { raid: '明日から店がない。君も私も', catch: '売上ゼロ。でも店は守った', zero: '接客した？ 椅子じゃないよな', low: '聞く耳はある。話す口を持て', mid: '悪くない。財布はもう少しあった', top: '財布の底まで笑って帰ったな', legend: '私の席を譲る。冗談だ。半分は', mom: '母が来た？ 請求書が怖い' },
      shareText: (who, s, b, r) => `一晩だけホストで${who}に¥${s.toLocaleString()}使ってもらった。シャンパン${b}本、称号は「${r}」。 #1日だけ職場体験 #一晩だけホスト`,
    },
    en: {
      series: 'ONE-DAY JOB #5', title: 'HOST FOR A NIGHT', sub: 'One guest. How much will they spend?', start: 'Clock in', howto: 'How to play', close: 'Close', load: 'Polishing the glasses', privacy: 'Privacy',
      how: ['You host one guest all night. How much will she spend before leaving?', 'Answer each line with one of 3 replies. Her things and gestures tell the truth', 'Lines anyone could say are weak. Notice her details, follow up on answers', 'When she leans in, offer a bottle. Cheapest first, one step at a time', 'Too early is a hard sell. Twice and she leaves. Watch her wallet too', 'One slip can be saved. Never tell the same story twice', 'Romance bait and tabs shut the whole club down'],
      legal: 'This game is satire. No relation to real clubs or people. Drink only when of legal age.',
      boss: 'Manager', naikin: 'Floor staff',
      intro: ['A temp? You get one guest tonight', 'Her things and gestures tell the truth', 'Fun first, then bottles. Cheapest first'], next: 'Next', skip: 'Skip',
      tut: { bottle: 'Leaning in. Time to offer' },
      bottle: 'Offer a bottle', menu: 'DRINK MENU', back: 'Back', ura: 'senior\'s scribbles', love: 'Be my girlfriend', tsuke: 'Pay me later, no worries',
      loveYen: 1000000, tsukeYen: 1500000, idcheck: 'Check her ID first', sold: 'SOLD', locked: 'One at a time, cheapest first',
      stopLove: 'That shuts the whole club down!', stopTsuke: 'We stopped doing tabs here!', stopFine: 'Written apology', stopOk: 'Sorry',
      raidLove: 'Exploiting a guest\'s romantic feelings can shut a club down. 2025 law', raidTsuke: 'Someone reported us for pressuring guests over tabs', raidMinor: 'You served alcohol to a minor', raidTax: 'That ledger wrote it all down', raidStamp: 'SHUT DOWN', toSlip: 'See payslip',
      minorSent: 'Staff will see her home', nomiFee: 'Request fee', spent: n => `${n} spent`, bottlesHud: n => `Bottles ${n}`, again: 'Again', toTitle: 'Title', save: 'Save image', post: 'Post on X',
      job: 'Host club', name: 'One-night host', footer: 'tom3games.github.io/job-host',
      payComm: 'Commission', payNomi: 'Request bonus', payBottle: 'Champagne', payMinor: 'Sharp eye', dedWarn: 'Apology', dedRaid: 'Shutdown losses', unitN: '', unitT: 'x', unitP: '', note: (who, a) => `20% of ${who}'s ¥${a.toLocaleString()}`,
      ranks: { raid: 'SHUT\nDOWN', catch: 'SHARP\nEYE', zero: 'FIRED', low: 'ROOKIE', mid: 'PASS', top: 'TOP\nHOST', legend: 'LEGEND' }, rankName: { raid: 'Shut down', catch: 'Sharp-eyed rookie', zero: 'Fired', low: 'Rookie', mid: 'Pass', top: 'Top host tonight', legend: 'Legendary rookie' },
      comments: { raid: 'No club tomorrow. For either of us', catch: 'Zero sales. But you saved the club', zero: 'You served whom? Are you a chair?', low: 'You can listen. Now learn to talk', mid: 'Not bad. Her wallet had more in it', top: 'She emptied her wallet, smiling', legend: 'Take my seat. Joking. Half joking', mom: 'My mother came? Fear the bill' },
      shareText: (who, s, b, r) => `Host for a Night: ${who} spent ¥${s.toLocaleString()}, ${b} champagne, rank "${r}". #OneDayJob`,
    },
  }
  return { ATT, WALLET, LINE, BOTTLE, CALL, UI }
})()
