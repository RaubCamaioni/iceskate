import { test } from 'node:test';
import assert from 'node:assert/strict';
import { priceFor, priceRows } from '../public/pricing.js';

const cabinJohn = [
  { category: 'public_skate', label: 'Public skate', price: '$9', note: 'tots $5, senior $7 weekdays' },
  { category: 'public_skate', label: 'Cheapskate', price: '$9', note: 'rental included' },
  { category: 'rental', label: 'Skate rental', price: '$4' },
  { category: 'stick_and_puck', label: 'Stick and Puck', price: '$11 to $15', note: 'by session length' },
  { category: 'freestyle', label: 'Freestyle', price: '$9 per 30 min' },
  { category: 'pass', label: 'Discount ticket book', price: '$81 for 10' },
];
const frederick = [
  { category: 'public_skate', label: 'Public skate, weekday', price: '$7.50' },
  { category: 'public_skate', label: 'Cheapskate (Tue, Thu)', price: '$6' },
  { category: 'public_skate', label: 'Friday Chill Out', price: '$8' },
  { category: 'public_skate', label: 'Public skate, weekend', price: '$11' },
  { category: 'stick_and_puck', label: 'Stick & Shoot', price: '$12' },
];
const capitals = [
  { category: 'public_skate', label: 'Public skate', price: '$8 to $15' },
  { category: 'pickup_hockey', label: 'Pickup hockey 18+', price: '$20' },
  { category: 'public_skate', label: 'Arlington Senior Skate', price: '$1' },
];
const loudoun = [
  { category: 'public_skate', label: 'Public skate', price: '$10' },
  { category: 'public_skate', label: 'Cheap Skate (selected weekdays)', price: '$6' },
  { category: 'rental', label: 'Skate rental', price: '$5' },
];

test('a session named after a price entry gets that price', () => {
  assert.equal(priceFor({ title: 'Cheapskate (includes rental)', category: 'public_skate', start: '2026-11-03T08:00:00' }, cabinJohn).label, 'Cheapskate');
  assert.equal(priceFor({ title: 'Cheap Skate', category: 'public_skate', start: '2026-11-03T12:00:00' }, loudoun).price, '$6');
  assert.equal(priceFor({ title: 'Friday Chill Out', category: 'public_skate', start: '2026-11-06T19:00:00' }, frederick).price, '$8');
  assert.equal(priceFor({ title: 'Cheapskate', category: 'public_skate', start: '2026-11-03T12:00:00' }, frederick).price, '$6');
  assert.equal(priceFor({ title: 'Arlington County Senior Skate', category: 'adult_skate', start: '2026-11-03T10:00:00' }, capitals).price, '$1');
});

test('weekday and weekend prices follow the date', () => {
  assert.equal(priceFor({ title: '', category: 'public_skate', start: '2026-11-03T12:00:00' }, frederick).price, '$7.50'); // Tuesday
  assert.equal(priceFor({ title: '', category: 'public_skate', start: '2026-11-07T12:00:00' }, frederick).price, '$11'); // Saturday
});

test('untitled sessions get the plain category price; restricted skates use the public skate price', () => {
  assert.equal(priceFor({ title: '', category: 'public_skate', start: '2026-11-07T12:00:00' }, cabinJohn).label, 'Public skate');
  assert.equal(priceFor({ title: 'Adults only (18+)', category: 'adult_skate', start: '2026-11-03T09:30:00' }, cabinJohn).label, 'Public skate');
  assert.equal(priceFor({ title: 'Parent and Tot', category: 'family_skate', start: '2026-11-03T09:30:00' }, cabinJohn).label, 'Public skate');
  assert.equal(priceFor({ title: 'Stick & Puck', category: 'stick_and_puck', start: '2026-11-03T12:00:00' }, cabinJohn).price, '$11 to $15');
  assert.equal(priceFor({ title: 'Adult Pickup Hockey (18+)', category: 'pickup_hockey', start: '2026-11-03T12:00:00' }, capitals).price, '$20');
  assert.equal(priceFor({ title: '', category: 'public_skate', start: '2026-11-03T12:00:00' }, loudoun).price, '$10');
});

test('no price for categories a rink does not publish', () => {
  assert.equal(priceFor({ title: 'Freestyle', category: 'freestyle', start: '2026-11-03T12:00:00' }, capitals), null);
  assert.equal(priceFor({ title: 'EHL 10U vs 12U', category: 'hockey', start: '2026-11-03T12:00:00' }, cabinJohn), null);
  assert.equal(priceFor({ title: '', category: 'public_skate' }, []), null);
});

test('priceRows splits a note into tiers and remarks', () => {
  assert.deepEqual(priceRows({ label: 'Public skate', price: '$15', note: 'child $8, senior $5; rental not included' }),
    { rows: [{ label: 'Standard', amount: '$15' }, { label: 'Child', amount: '$8' }, { label: 'Senior', amount: '$5' }], remarks: ['Rental not included'] });
  assert.deepEqual(priceRows({ label: 'Public skate', price: '$9', note: 'tots $5, senior $7 weekdays' }),
    { rows: [{ label: 'Standard', amount: '$9' }, { label: 'Tots', amount: '$5' }, { label: 'Senior, weekdays', amount: '$7' }], remarks: [] });
  assert.deepEqual(priceRows({ label: 'Public skate', price: '$8 to $15', note: 'general $15; adult $9 and 12-and-under $8 sessions; paid online' }),
    { rows: [{ label: 'General', amount: '$15' }, { label: 'Adult', amount: '$9' }, { label: '12-and-under', amount: '$8' }], remarks: ['Paid online'] });
  assert.deepEqual(priceRows({ label: 'Public skate, adult', price: '$14', note: 'youth and senior $10, child 4 and under $4, family of 5 $40; rental included' }),
    { rows: [{ label: 'Adult', amount: '$14' }, { label: 'Youth and senior', amount: '$10' }, { label: 'Child 4 and under', amount: '$4' }, { label: 'Family of 5', amount: '$40' }], remarks: ['Rental included'] });
  assert.deepEqual(priceRows({ label: 'Cheapskate', price: '$9', note: 'rental included' }),
    { rows: [{ label: 'Cheapskate', amount: '$9' }], remarks: ['Rental included'] });
  assert.deepEqual(priceRows({ label: 'Stick and Puck', price: '$11 to $15', note: 'by session length' }),
    { rows: [{ label: 'Stick and Puck', amount: '$11 to $15' }], remarks: ['By session length'] });
  assert.deepEqual(priceRows({ label: 'Stick & Shoot', price: '$12', note: 'goalies $6' }),
    { rows: [{ label: 'Stick & Shoot', amount: '$12' }, { label: 'Goalies', amount: '$6' }], remarks: [] });
  assert.deepEqual(priceRows({ label: 'Public skate, weekday', price: '$7.50', note: 'child $7, senior $6' }),
    { rows: [{ label: 'Weekday', amount: '$7.50' }, { label: 'Child', amount: '$7' }, { label: 'Senior', amount: '$6' }], remarks: [] });
});
