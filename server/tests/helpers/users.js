const request = require('supertest');
const User = require('../../src/models/User');

/** Signs up a player through the API and returns { token, user, auth } where auth is the header value. */
async function createPlayer(app, username) {
  const res = await request(app).post('/api/auth/signup')
    .send({ username, email: `${username.toLowerCase()}@example.com`, password: 'secret123' });
  if (res.status !== 201) throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, user: res.body.user, auth: `Bearer ${res.body.token}` };
}

async function createGuest(app, nickname = 'Visitor_9') {
  const res = await request(app).post('/api/auth/guest').send({ nickname });
  return { token: res.body.token, guest: res.body.guest, auth: `Bearer ${res.body.token}` };
}

/** Creates a practice room as the given player or guest and returns its code. */
async function createRoom(app, auth, theme) {
  const res = await request(app).post('/api/practice').set('Authorization', auth).send(theme ? { theme } : {});
  if (res.status !== 201) throw new Error(`createRoom failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.code;
}

/** A player who also holds `role`, added straight in the DB (roles are read fresh on each request, D4). */
async function createWithRole(app, username, role) {
  const player = await createPlayer(app, username);
  await User.updateOne({ _id: player.user.id }, { $addToSet: { roles: role } });
  return player;
}

const createAdmin = (app, username = 'admin1') => createWithRole(app, username, 'admin');
const createOrganizer = (app, username = 'org1') => createWithRole(app, username, 'organizer');

module.exports = { createPlayer, createGuest, createRoom, createAdmin, createOrganizer };
