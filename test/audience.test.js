import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audience, sessionLabel } from '../public/audience.js';

const who = (title, subtitle = '') => audience({ title, subtitle });

test('age floors from titles and descriptions', () => {
  assert.deepEqual(who('Adults only (18+)'), { text: '18+ only', restricted: true });
  assert.deepEqual(who('Adults only (14+)'), { text: '14+ only', restricted: true });
  assert.deepEqual(who('Adult Skate (18+ Skaters ONLY)'), { text: '18+ only', restricted: true });
  assert.deepEqual(who('', 'Adult pickup hockey is open to ages 18 and older. Full Gear Is Required'), { text: '18+ only', restricted: true });
  assert.deepEqual(who('', 'You must be 18 or older to participate'), { text: '18+ only', restricted: true });
});

test('groups and age ranges', () => {
  assert.deepEqual(who('Parent and Tot'), { text: 'Parent & tot', restricted: true });
  assert.deepEqual(who('Playground on Ice- Weekend'), { text: 'Little kids + adult', restricted: true });
  assert.deepEqual(who('Arlington County Senior Skate'), { text: 'Seniors', restricted: true });
  assert.deepEqual(who('Adult Swim'), { text: 'Adults only', restricted: true });
  assert.deepEqual(who('Stick n Shoot 12U'), { text: 'Ages 12 and under', restricted: true });
  assert.deepEqual(who('Mini Stick n Shoot', "Stick n' Shoot for 10 and under only"), { text: 'Ages 10 and under', restricted: true });
  assert.deepEqual(who('Youth (13 and under)'), { text: 'Ages 13 and under', restricted: true });
  assert.deepEqual(who('Hockey 1 (Ages 9-14)- Thursday 6:30pm'), { text: 'Ages 9–14', restricted: true });
  assert.deepEqual(who('Stick Time - Youth'), { text: 'Youth only', restricted: true });
  assert.deepEqual(who("Women's Scrimmage NOV 5"), { text: 'Women', restricted: true });
});

test('open sessions get no restriction', () => {
  assert.equal(who(''), null);
  assert.equal(who('Cheapskate (includes rental)'), null);
  assert.equal(who('Disco Skate'), null);
  assert.equal(who('Recess'), null);
  assert.deepEqual(who('Stick & Shoot', 'Open hockey for all ages.'), { text: 'All ages', restricted: false });
  assert.deepEqual(who('Family Pick Up Hockey', 'open to all ages. Full gear is required!'), { text: 'All ages', restricted: false });
  assert.deepEqual(who('SHSA On Ice Stroking', 'for skating levels Freeskate 1 and above. Adults welcome.'), { text: 'All ages', restricted: false });
});

test('session labels strip generic words and duplicates of the badge', () => {
  assert.equal(sessionLabel({ title: '' }), null);
  assert.equal(sessionLabel({ title: 'Public-Weekday Afternoon' }), null);
  assert.equal(sessionLabel({ title: 'Public Skate- HALLOWEEN SKATE in costume' }), 'HALLOWEEN SKATE in costume');
  assert.equal(sessionLabel({ title: 'Cheapskate (includes rental)' }), 'Cheapskate');
  assert.equal(sessionLabel({ title: 'Adults only (18+)' }), null);
  assert.equal(sessionLabel({ title: 'Parent and Tot' }), null);
  assert.equal(sessionLabel({ title: 'Friday Chill Out' }), 'Friday Chill Out');
  assert.equal(sessionLabel({ title: "Public- Friday Rockin' Skate" }), "Friday Rockin' Skate");
});
