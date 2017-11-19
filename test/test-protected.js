require('dotenv').config();
const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const {app, runServer, closeServer} = require('../server');
const {User, Watchlist} = require('../users');
const {JWT_SECRET, DATABASE_URL} = require('../config');

const expect = chai.expect;

chai.use(chaiHttp);

function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('Protected endpoint', function() {
    const username = 'Gryffindor';
    const password = 'Fortuna Major';
    const firstName = 'Albus';
    const lastName = 'Dumbledore';

    const watchlist = {
        gameIds: ['Quidditch', 'World', 'Cup']
    }

    before(function() {
        return runServer(DATABASE_URL);
    });

    after(function() {
        return closeServer();
    });

    beforeEach(function() {
        return User.hashPassword(password)
        .then(hash => {
            return User.create({
                username,
                password: hash,
                firstName,
                lastName
            });
        })
        .then(user =>
             Watchlist.create({
                userId: user._id
            })
        );
    });

    afterEach(function() {
        return tearDownDb();
    });

    describe('/dashboard', function() {
        it('Should reject requests with no credentials', function() {
            return chai
                .request(app)
                .get('/dashboard')
                .then(() =>
                    expect.fail(null, null, 'Request should not succeed')
                )
                .catch(err => {
                    if (err instanceof chai.AssertionError) {
                        throw err;
                    }

                    const res = err.response;
                    expect(res).to.have.status(401);
                });
        });

        it('Should reject requests with an invalid token', function() {
            const token = jwt.sign(
                {
                    username,
                    firstName,
                    lastName
                },
                'wrongSecret',
                {
                    algorithm: 'HS256',
                    expiresIn: '7d'
                }
            );

            return chai
                .request(app)
                .get('/dashboard')
                .set('Authorization', `Bearer ${token}`)
                .then(() =>
                    expect.fail(null, null, 'Request should not succeed')
                )
                .catch(err => {
                    if (err instanceof chai.AssertionError) {
                        throw err;
                    }

                    const res = err.response;
                    expect(res).to.have.status(401);
                });
        });
        it('Should reject requests with an expired token', function() {
            const token = jwt.sign(
                {
                    user: {
                        username,
                        firstName,
                        lastName
                    },
                    exp: Math.floor(Date.now() / 1000) - 10 // Expired ten seconds ago
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: username
                }
            );

            return chai
                .request(app)
                .get('/dashboard')
                .set('authorization', `Bearer ${token}`)
                .then(() =>
                    expect.fail(null, null, 'Request should not succeed')
                )
                .catch(err => {
                    if (err instanceof chai.AssertionError) {
                        throw err;
                    }

                    const res = err.response;
                    expect(res).to.have.status(401);
                });
        });
        it('Should update protected data', function() {
            const token = jwt.sign(
                {
                    user: {
                        username,
                        firstName,
                        lastName
                    }   
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: username,
                    expiresIn: '7d'
                }
            );

            return chai
                .request(app)
                .put('/dashboard')
                .set('authorization', `Bearer ${token}`)
                .send(watchlist)
                .then(res => {
                    expect(res).to.have.status(201);
                    expect(res.body).to.be.an('object');
                    expect(res.body.gameIds).to.deep.equal(watchlist.gameIds);
                })
        })
        it('Should send protected data', function() {
            const token = jwt.sign(
                {
                    user: {
                        username,
                        firstName,
                        lastName
                    }
                },
                JWT_SECRET,
                {
                    algorithm: 'HS256',
                    subject: username,
                    expiresIn: '7d'
                }
            );

            return chai
                .request(app)
                .get('/dashboard')
                .set('authorization', `Bearer ${token}`)
                .then(res => {
                    expect(res).to.have.status(200);
                    expect(res.body).to.be.an('object');
                    expect(res.body.gameIds).to.be.an('array').that.is.empty;
                });
        });
    });
});
