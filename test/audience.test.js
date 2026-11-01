import { test } from 'node:test';
import assert from 'node:assert/strict';
import { audience, sessionLabel, refineCategory } from '../public/audience.js';

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
  assert.equal(who('Low Freestyle'), null);
  assert.deepEqual(who('Stick & Shoot', 'Open hockey for all ages.'), { text: 'All ages', restricted: false });
  assert.deepEqual(who('Family Pick Up Hockey', 'open to all ages. Full gear is required!'), { text: 'All ages', restricted: false });
  assert.deepEqual(who('SHSA On Ice Stroking', 'for skating levels Freeskate 1 and above. Adults welcome.'), { text: 'All ages', restricted: false });
});

test('stick and puck is all ages unless the rink says otherwise; public skate carries no badge', () => {
  const open = { text: 'All ages', restricted: false };
  assert.equal(audience({ title: '', category: 'public_skate' }), null);
  assert.equal(audience({ title: 'Cheapskate (includes rental)', category: 'public_skate' }), null);
  assert.deepEqual(audience({ title: 'Stick & Puck', subtitle: '', category: 'stick_and_puck' }), open);
  assert.deepEqual(audience({ title: 'Homeschooling Ice Session', category: 'public_skate' }), { text: 'Homeschool families', restricted: true });
  assert.deepEqual(audience({ title: 'Adults only (18+)', category: 'public_skate' }), { text: '18+ only', restricted: true });
  assert.deepEqual(audience({ title: 'Stick n Shoot 12U', category: 'stick_and_puck' }), { text: 'Ages 12 and under', restricted: true });
  assert.equal(audience({ title: '', category: 'pickup_hockey' }), null);
  assert.equal(audience({ title: 'Freestyle', category: 'freestyle' }), null);
});

test('restricted public skates move to adult_skate or family_skate', () => {
  const ps = (title, subtitle = '') => refineCategory({ title, subtitle, category: 'public_skate' });
  assert.equal(ps(''), 'public_skate');
  assert.equal(ps('Cheapskate (includes rental)'), 'public_skate');
  assert.equal(ps('Disco Skate'), 'public_skate');
  assert.equal(ps('Public Skate- HALLOWEEN SKATE in costume'), 'public_skate');
  assert.equal(ps('Adults only (18+)'), 'adult_skate');
  assert.equal(ps('Adults only (14+)'), 'adult_skate');
  assert.equal(ps('Adult Skate (18+ Skaters ONLY)', 'Join us for an Adult only public skate!'), 'adult_skate');
  assert.equal(ps('Adult Swim'), 'adult_skate');
  assert.equal(ps('Arlington County Senior Skate'), 'adult_skate');
  assert.equal(ps('Parent and Tot'), 'family_skate');
  assert.equal(ps('Playground on Ice- Weekend'), 'family_skate');
  assert.equal(ps('Homeschooling Ice Session', 'Home Schooling Ice'), 'family_skate');
  assert.equal(ps('Recess', 'Recess at the Rink is a special type of public skating session for 2-10 year olds'), 'family_skate');
  assert.equal(ps('Recess PM Nov', 'Recess on the rink for kids under 10'), 'family_skate');
  assert.deepEqual(audience({ title: 'Recess', subtitle: 'for 2-10 year olds', category: 'public_skate' }), { text: 'Ages 2–10', restricted: true });
  assert.deepEqual(audience({ title: 'Recess PM Nov', subtitle: 'Recess on the rink for kids under 10', category: 'public_skate' }), { text: 'Under 10 only', restricted: true });
  assert.equal(refineCategory({ title: 'Adults only (18+)', category: 'stick_and_puck' }), 'stick_and_puck');
  assert.equal(refineCategory({ title: 'Adult Pick-Up Hockey', category: 'pickup_hockey' }), 'pickup_hockey');
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
