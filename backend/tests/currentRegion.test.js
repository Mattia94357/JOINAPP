const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../dist/models/User').default;
const Activity = require('../dist/models/Activity').default;
const { DeviceRegion, insideRegion, locationIssue, PASSPORT_MESSAGE } = require('../dist/services/currentRegion');
const { reserveGeocodingRequest, providerGeocode } = require('../dist/services/placeSearch');

async function run() {
  process.env.JWT_SECRET = 'region-regression-only-secret-123456789012345';
  process.env.LOCATION_GEOCODING_ENABLED = 'false';
  process.env.IMAGE_UPLOADS_ENABLED = 'false';
  const mongo = await MongoMemoryServer.create();
  let server;
  const originalFetch = global.fetch;
  try {
    await mongoose.connect(mongo.getUri());
    await Promise.all([User.init(), Activity.init(), DeviceRegion.init()]);
    const user = await User.create({ name: 'Host', email: 'region@example.test', password: 'unused', location: 'Old manual city' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET);
    const app = express(); app.use(express.json());
    app.use('/api/locations', require('../dist/routes/locations').default);
    app.use('/api/activities', require('../dist/routes/activities').default);
    app.use('/api/users', require('../dist/routes/users').default);
    app.use(require('../dist/middleware/errorHandler').errorHandler);
    server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    const call = async (path, method = 'GET', body) => {
      const r = await originalFetch(`http://127.0.0.1:${server.address().port}/api${path}`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return { status: r.status, body: await r.json() };
    };
    const local = { latitude: -31.95, longitude: 115.86 };
    const remote = { latitude: 7.88, longitude: 98.39 };
    const draft = { title: 'Local coffee', category: 'Food', location: 'Perth', description: 'Coffee and relaxed conversation with local people.',
      ...local, date: new Date(Date.now() + 86400000).toISOString(), maxAttendees: 6, costType: 'Free',
      locationPrivacy: 'public', visibility: 'public', joinApproval: 'auto', clientRequestId: 'region-create-123' };
    assert.equal((await call('/activities', 'POST', draft)).status, 403, 'old stored profile location cannot grant a region');
    const override = await call('/users/me/profile', 'PATCH', { location: 'Other manual city' });
    assert.equal(override.status, 403, 'manual free-tier location override is forbidden');
    const registered = await call('/locations/current', 'POST', { ...local, radiusKm: 50000, label: 'Spoofed label' });
    assert.equal(registered.status, 200); assert.equal(registered.body.radiusKm, 50);
    assert.equal(registered.body.label, undefined, 'disabled provider never invents a city or trusts a client label');
    const anonymous = await originalFetch(`http://127.0.0.1:${server.address().port}/api/activities`);
    assert.equal(anonymous.status, 401, 'omitting the token cannot bypass region discovery');
    assert.equal((await call('/locations/suggestions?q=coffee')).status, 503);
    const created = await call('/activities', 'POST', draft);
    assert.equal(created.status, 201, JSON.stringify(created.body));
    assert.equal(created.body.coverImageAsset, undefined, 'default-image path needs no R2 upload');
    assert.equal(await Activity.countDocuments(), 1);
    assert.equal((await call('/activities', 'POST', draft)).status, 200, 'idempotent retry');
    const outside = await call('/activities', 'POST', { ...draft, ...remote, clientRequestId: 'region-remote-123' });
    assert.equal(outside.status, 403); assert.equal(outside.body.message, PASSPORT_MESSAGE);
    const invalid = await call('/activities', 'POST', { ...draft, title: 'Hi' });
    assert.equal(invalid.status, 400); assert.equal(invalid.body.errors[0].field, 'title');
    assert.equal(invalid.body.errors[0].value, undefined, 'validation does not echo sensitive input');
    const edit = await call(`/activities/${created.body._id}`, 'PATCH', remote);
    assert.equal(edit.status, 403); assert.equal(edit.body.message, PASSPORT_MESSAGE);
    await Activity.create({ ...draft, ...remote, title: 'Remote activity', host: user._id, participants: [user._id], clientRequestId: undefined });
    const feed = await call('/activities'); assert.equal(feed.status, 200); assert.equal(feed.body.length, 1);
    assert.equal(JSON.stringify(feed.body).includes('radiusKm'), false, 'device region never appears in activity payloads');
    assert.equal(locationIssue(null, local), 'Refresh your current device location before continuing.');
    assert.equal(insideRegion({ ...local, radiusKm: 50 }, remote), false);
    assert.equal(insideRegion({ ...local, radiusKm: 50 }, { latitude: -31.96, longitude: 115.87 }), true);
    assert.equal(insideRegion({ latitude: 0, longitude: 179.99, radiusKm: 50 }, { latitude: 0, longitude: -179.99 }), true);
    const budget = await Promise.all(Array.from({ length: 12 }, () => reserveGeocodingRequest('test-budget', 3)));
    assert.equal(budget.filter(Boolean).length, 3, 'shared atomic cap withstands concurrent requests');
    global.fetch = async url => {
      const u = new URL(url); assert.equal(u.searchParams.get('proximity'), '115.86,-31.95');
      assert.ok(u.searchParams.get('bbox')); assert.equal(u.searchParams.get('limit'), '6');
      return { ok: true, json: async () => ({ features: [
        { id: 'local', text: 'Cafe', place_name: 'Cafe, Northbridge, Perth', center: [115.86, -31.95] },
        { id: 'remote', text: 'Remote', place_name: 'Remote city', center: [98.39, 7.88] },
      ] }) };
    };
    const places = await providerGeocode('coffee', { ...local, radiusKm: 50 });
    assert.equal(places.length, 1); assert.equal(places[0].name, 'Cafe');
    process.env.LOCATION_GEOCODING_ENABLED = 'true'; process.env.MAPTILER_SERVER_API_KEY = 'mock-only-key';
    global.fetch = async url => {
      assert.equal(new URL(url).searchParams.get('types'), 'municipality,region,country');
      return { ok: true, json: async () => ({ features: [{ text: 'Perth', place_name: 'Perth, Western Australia, Australia', center: [115.86, -31.95] }] }) };
    };
    const labelled = await call('/locations/current', 'POST', local);
    assert.equal(labelled.body.label, 'Perth, Western Australia, Australia');
    assert.equal((await User.findById(user.id)).location, labelled.body.label);
    process.env.LOCATION_GEOCODING_ENABLED = 'false';
    const moved = await call('/locations/current', 'POST', remote);
    assert.equal(moved.body.label, undefined);
    assert.equal((await DeviceRegion.findById(user.id)).label, undefined, 'moving with no geocoder clears stale region label');
    assert.equal((await User.findById(user.id)).location, undefined, 'old Profile label is not retained as a current place');
    await DeviceRegion.updateOne({ _id: user.id }, { expiresAt: new Date(0) });
    assert.equal((await call('/activities', 'POST', { ...draft, clientRequestId: 'expired-region-123' })).status, 403);
    console.log('PASS region, discovery, autocomplete filtering/bias, atomic cost budget, validation, publish/default-image and expiry regressions');
  } finally {
    global.fetch = originalFetch;
    if (server) await new Promise(resolve => server.close(resolve));
    await mongoose.disconnect(); await mongo.stop();
  }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
