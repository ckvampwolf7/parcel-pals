// Owner: Characters team (see docs/TEAM_BRIEF.md). Keys are relative: t('characters.<key>').
// Pal names live in common (common.char.<kind>).
export default {
  ko: {
    // alt text for <Character title> : "{name}, {mood}"
    alt: '{name}, {mood}',
    'mood.idle': '쉬는 중',
    'mood.moving': '열심히 가는 중',
    'mood.waiting': '출발을 기다리는 중',
    'mood.sleeping': '쿨쿨 쉬는 중',
    'mood.worried': '조금 걱정하는 중',
    'mood.happy': '신난 표정',
    'mood.celebrating': '도착을 축하하는 중',

    'truck.sound': '부릉부릉!',
    'truck.tagline': '든든한 국내 배송 담당',
    'truck.catchphrase': '부릉부릉! 제가 제시간에 데려다줄게요.',
    'plane.sound': '슝~',
    'plane.tagline': '구름 위를 나는 해외 배송 여행가',
    'plane.catchphrase': '슝~ 구름 위로 날아서 갈게요!',
    'bunny.sound': '깡총!',
    'bunny.tagline': '작지만 힘센 지름길 전문가',
    'bunny.catchphrase': '깡총! 작아도 제일 빨라요.',

    'picker.autoHint': '자동: 국내 택배는 붕붕이, 해외 택배는 슝슝이가 맡아요.',
    'box.alt': '택배 상자',
  } as Record<string, string>,
  en: {
    alt: '{name}, {mood}',
    'mood.idle': 'standing by',
    'mood.moving': 'on the move',
    'mood.waiting': 'waiting to set off',
    'mood.sleeping': 'taking a nap',
    'mood.worried': 'a little worried',
    'mood.happy': 'happy',
    'mood.celebrating': 'celebrating the delivery',

    'truck.sound': 'Vroom!',
    'truck.tagline': 'Your dependable road pal',
    'truck.catchphrase': "Vroom! I'll get it to you right on time.",
    'plane.sound': 'Whoosh~',
    'plane.tagline': 'Dreamy globe-trotter for overseas parcels',
    'plane.catchphrase': "Whoosh~ I'll fly it over the clouds!",
    'bunny.sound': 'Hop hop!',
    'bunny.tagline': 'Tiny but mighty shortcut expert',
    'bunny.catchphrase': 'Hop hop! Tiny, but the quickest.',

    'picker.autoHint': 'Auto: Vroomy takes domestic parcels, Zoomy takes international ones.',
    'box.alt': 'Parcel box',
  } as Record<string, string>,
};
