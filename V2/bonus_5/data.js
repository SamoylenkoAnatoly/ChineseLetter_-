window.TAVERN_DATA = (function () {
  'use strict';

  var WORDS = [
    { id: 'w-zhong', hanzi: '中', pinyin: 'zhōng', ru: 'центр; середина', note: 'Черта прямо посередине иероглифа — само слово «середина».' },
    { id: 'w-zhongxin', hanzi: '中心', pinyin: 'zhōngxīn', ru: 'центр; середина', note: 'Сердце середины: центр города, центр внимания.' },
    { id: 'w-ren', hanzi: '人', pinyin: 'rén', ru: 'человек', note: 'Силуэт шагающего человека из двух опорных черт.' },
    { id: 'w-renkou', hanzi: '人口', pinyin: 'rénkǒu', ru: 'население', note: 'Буквально «люди и рты»: сколько ртов нужно прокормить.' },
    { id: 'w-renpin', hanzi: '人品', pinyin: 'rénpǐn', ru: 'репутация человека; характер', note: 'Черта характера и репутация человека; современное значение связано с удачей.' },
    { id: 'w-renxin', hanzi: '人心', pinyin: 'rénxīn', ru: 'человеческое сердце; чувства людей', note: 'Сердца и настроения людей, как в обороте «завоевать сердца».' },
    { id: 'w-zhong3', hanzi: '众', pinyin: 'zhòng', ru: 'толпа; множество', note: 'Три человека вместе — уже толпа.' },
    { id: 'w-zhongren', hanzi: '众人', pinyin: 'zhòngrén', ru: 'все люди; собравшиеся', note: 'Множество людей, все присутствующие.' },
    { id: 'w-shao', hanzi: '勺', pinyin: 'sháo', ru: 'ложка; черпак', note: 'Рисунок черпака с каплей внутри.' },
    { id: 'w-kou', hanzi: '口', pinyin: 'kǒu', ru: 'рот; отверстие', note: 'Очертание открытого рта.' },
    { id: 'w-you', hanzi: '右', pinyin: 'yòu', ru: 'право; правая сторона', note: 'Рот 口 под рукой 又: правая рука помогает рту.' },
    { id: 'w-ming', hanzi: '名', pinyin: 'míng', ru: 'имя', note: 'Вечер 夕 и рот 口: вечером называют своё имя.' },
    { id: 'w-mingren', hanzi: '名人', pinyin: 'míngrén', ru: 'известный человек; знаменитость', note: 'Человек с именем, прославленный человек.' },
    { id: 'w-pin', hanzi: '品', pinyin: 'pǐn', ru: 'товар; качество', note: 'Три сосуда-рта: ассортимент и его качество.' },
    { id: 'w-xi', hanzi: '夕', pinyin: 'xī', ru: 'вечер', note: 'Полумесяц — время, когда стемнело.' },
    { id: 'w-xin', hanzi: '心', pinyin: 'xīn', ru: 'сердце', note: 'Схематичное изображение сердца.' },
    { id: 'w-bi', hanzi: '必', pinyin: 'bì', ru: 'необходимо; обязательно', note: 'Сердце, пронзённое клятвой: «обязательно сделаю».' },
    { id: 'w-xi2', hanzi: '息', pinyin: 'xī', ru: 'отдых; вздох; интерес', note: 'Сам 自 и сердце 心: перевести дыхание — отдохнуть.' },
    { id: 'w-xiang3', hanzi: '想', pinyin: 'xiǎng', ru: 'думать; хотеть', note: 'Взаимно 相 на сердце 心 — размышлять.' },
    { id: 'w-ri', hanzi: '日', pinyin: 'rì', ru: 'солнце; день', note: 'Круглое солнце с точкой-бликом внутри.' },
    { id: 'w-riyue', hanzi: '日月', pinyin: 'rìyuè', ru: 'солнце и луна', note: 'Солнце 日 и луна 月 вместе, как в названии моря 日月潭.' },
    { id: 'w-riyong', hanzi: '日用', pinyin: 'rìyòng', ru: 'повседневное использование', note: 'Ежедневное применение, как в «товарах на каждый день».' },
    { id: 'w-riyongpin', hanzi: '日用品', pinyin: 'rìyòngpǐn', ru: 'товары повседневного спроса', note: 'Товары, которыми пользуются каждый день.' },
    { id: 'w-ming2', hanzi: '明', pinyin: 'míng', ru: 'светлый; ясный', note: 'Солнце и луна рядом — полная ясность.' },
    { id: 'w-mingyue', hanzi: '明月', pinyin: 'míngyuè', ru: 'яркая луна', note: 'Ясная, светлая луна.' },
    { id: 'w-mingbai', hanzi: '明白', pinyin: 'míngbai', ru: 'понимать; ясно', note: 'Светло и прозрачно — значит, понятно.' },
    { id: 'w-yue', hanzi: '月', pinyin: 'yuè', ru: 'луна; месяц', note: 'Серп молодого месяца.' },
    { id: 'w-yueri', hanzi: '月日', pinyin: 'yuè rì', ru: 'месяц и день', note: 'Редкое сочетание «месяц и день»; обычное слово для даты — 日子, а для числа месяца — 号.' },
    { id: 'w-you2', hanzi: '有', pinyin: 'yǒu', ru: 'иметь; обладать', note: 'Рука, держащая нечто: «у меня есть».' },
    { id: 'w-youming', hanzi: '有名', pinyin: 'yǒumíng', ru: 'известный; знаменитый', note: 'Иметь имя — быть известным.' },
    { id: 'w-youyong', hanzi: '有用', pinyin: 'yǒuyòng', ru: 'полезный', note: 'Иметь применение — приносить пользу.' },
    { id: 'w-peng', hanzi: '朋', pinyin: 'péng', ru: 'друг', note: 'Две раковины рядком, как верные друзья; обычно в составе слов 朋友 и 亲朋好友.' },
    { id: 'w-mu', hanzi: '木', pinyin: 'mù', ru: 'дерево', note: 'Ствол с ветвями и корнями.' },
    { id: 'w-lin', hanzi: '林', pinyin: 'lín', ru: 'лес; роща', note: 'Два дерева — уже роща.' },
    { id: 'w-shu', hanzi: '术', pinyin: 'shù', ru: 'искусство; метод', note: 'Приём мастерства: техника, метод, учение.' },
    { id: 'w-yong', hanzi: '用', pinyin: 'yòng', ru: 'использовать', note: 'Древние часы: всё, что можно применить.' },
    { id: 'w-yongpin', hanzi: '用品', pinyin: 'yòngpǐn', ru: 'принадлежности; изделия', note: 'Предметы для использования: хозяйственные изделия.' },
    { id: 'w-yongxin', hanzi: '用心', pinyin: 'yòngxīn', ru: 'старание; усердие', note: 'Применять сердце к делу — быть внимательным.' },
    { id: 'w-bai', hanzi: '白', pinyin: 'bái', ru: 'белый', note: 'Луч солнца — белый свет.' },
    { id: 'w-de', hanzi: '的', pinyin: 'de', ru: 'притяжательная частица', note: 'Соединяет определение со словом: «мой、тёплый чай».' },
    { id: 'w-mu2', hanzi: '目', pinyin: 'mù', ru: 'глаз', note: 'Глаз, повёрнутый вертикально.' },
    { id: 'w-xiang1', hanzi: '相', pinyin: 'xiāng', ru: 'взаимно; друг друга', note: 'Смотреть глазами на дерево — наблюдение; здесь учебное значение «взаимно».' },
    { id: 'w-zi', hanzi: '自', pinyin: 'zì', ru: 'сам; себя', note: 'Нос: указывая на себя, показывают на нос.' }
  ];

  var unique = Object.create(null);
  var seenHanzi = Object.create(null);
  for (var i = 0; i < WORDS.length; i += 1) {
    var item = WORDS[i];
    if (unique[item.id]) {
      throw new Error('data.js: duplicate word id ' + item.id);
    }
    if (seenHanzi[item.hanzi]) {
      throw new Error('data.js: duplicate hanzi ' + item.hanzi);
    }
    unique[item.id] = true;
    seenHanzi[item.hanzi] = true;
  }

  var PLAYERS = [
    {
      id: 'cinnabon',
      name: 'Синнабон',
      title: 'трактирная целительница',
      portrait: '../assets/characters/cinnabon.svg',
      power: { id: 'heal', name: 'Тёплый отвар', mana: 2, desc: 'Восстановить 3 HP вашему герою (не выше 30).' }
    },
    {
      id: 'raccoon',
      name: 'Енот',
      title: 'картёжник-щелкун',
      portrait: '../assets/characters/raccoon.svg',
      power: { id: 'draw', name: 'Тайный рукав', mana: 2, desc: 'Взять карту.' }
    },
    {
      id: 'robot',
      name: 'Робот',
      title: 'жестяной вышибала',
      portrait: '../assets/characters/robot.svg',
      power: { id: 'shield', name: 'Жестяной заслон', mana: 2, desc: 'Щит на 3 урона вашему герою до начала вашего следующего хода (не суммируется).' }
    },
    {
      id: 'wizard',
      name: 'Волшебник',
      title: 'хранитель свечей',
      portrait: '../assets/characters/wizard.svg',
      power: { id: 'bolt', name: 'Всполох', mana: 2, desc: 'Нанести 2 урона выбранному врагу.' }
    },
    {
      id: 'zhabert',
      name: 'Жаберт',
      title: 'болотный наставник',
      portrait: '../assets/characters/zhabert.svg',
      power: { id: 'buff', name: 'Болотная закваска', mana: 2, desc: 'Дать своему бойцу +1/+1.' }
    }
  ];

  var ABILITIES = {
    barrier: { name: 'Щит', short: 'Первый урон — 0', text: 'Полностью поглощает первое попадание с положительным уроном.' },
    rush: { name: 'Натиск', short: 'Сразу по бойцу', text: 'В ход появления атакует только бойца. Со следующего хода — любую вражескую цель.' },
    medic: { name: 'Лекарь', short: 'Герою +2 HP', text: 'При появлении восстанавливает своему герою 2 HP, не выше 30.' }
  };

  var MINION_TEMPLATES = [
    { kind: 'minion', cost: 1, atk: 2, hp: 1, name: 'Трактирный половой', text: '', ability: null },
    { kind: 'minion', cost: 2, atk: 2, hp: 3, name: 'Музыкант с лютней', text: '', ability: null },
    { kind: 'minion', cost: 3, atk: 3, hp: 3, name: 'Страж ворот', text: '', ability: null },
    { kind: 'minion', cost: 4, atk: 4, hp: 4, name: 'Наёмник в кольчуге', text: '', ability: null },
    { kind: 'minion', cost: 5, atk: 5, hp: 5, name: 'Вышибала у входа', text: '', ability: null },
    { kind: 'minion', cost: 2, atk: 1, hp: 2, name: 'Щитоносец', text: ABILITIES.barrier.text, ability: 'barrier' },
    { kind: 'minion', cost: 3, atk: 3, hp: 2, name: 'Трактирный налётчик', text: ABILITIES.rush.text, ability: 'rush' },
    { kind: 'minion', cost: 3, atk: 2, hp: 3, name: 'Полевой лекарь', text: ABILITIES.medic.text, ability: 'medic' }
  ];

  var HERO_MAX_HP = 30;
  var BOARD_SIZE = 5;
  var HAND_LIMIT = 8;
  var START_HAND_SIZE = 3;
  var MATCH_MS = 10 * 60 * 1000;
  var MAX_MANA = 10;
  var MIN_MANA = 1;

  var POWERS = {
    heal: { id: 'heal', mana: 2, target: 'none' },
    draw: { id: 'draw', mana: 2, target: 'none' },
    shield: { id: 'shield', mana: 2, target: 'none' },
    bolt: { id: 'bolt', mana: 2, target: 'enemy-any' },
    buff: { id: 'buff', mana: 2, target: 'own-minion' }
  };

  return {
    WORDS: WORDS,
    PLAYERS: PLAYERS,
    ABILITIES: ABILITIES,
    MINION_TEMPLATES: MINION_TEMPLATES,
    HERO_MAX_HP: HERO_MAX_HP,
    BOARD_SIZE: BOARD_SIZE,
    HAND_LIMIT: HAND_LIMIT,
    START_HAND_SIZE: START_HAND_SIZE,
    MATCH_MS: MATCH_MS,
    MAX_MANA: MAX_MANA,
    MIN_MANA: MIN_MANA,
    POWERS: POWERS
  };
}());
