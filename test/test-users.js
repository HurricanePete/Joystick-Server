global.DATABASE_URL = 'mongodb://localhost/test-db';

const chai = require('chai');
const chaiHttp = require('chai-http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

const {app, runServer, closeServer} = require('../server');
const {User, Watchlist} = require('../users');
const {JWT_SECRET} = require('../config');

const expect = chai.expect;

chai.use(chaiHttp);

function tearDownDb() {
    console.warn('Deleting database');
    return mongoose.connection.dropDatabase();
}

describe('/users', function() {
	const username = 'exampleUser';
	const password = 'examplePass';
	const email = 'example@example.com';
	const usernameB = 'exampleUserB';
	const passwordB = 'examplePassB';
	const emailB = 'exampleB@bExample.com' 

	before(function() {
		return runServer(DATABASE_URL);
	});

	after(function() {
		return closeServer();
	});

	beforeEach(function() {});

	afterEach(function() {
		return tearDownDb();
	});

	describe('/users', function() {
		describe('POST', function() {
			it('Should reject users with missing username', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						password,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Missing field');
						expect(res.body.location).to.equal('username');
					});
			});
			it('Should reject users with missing password', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Missing field');
						expect(res.body.location).to.equal('password');
					});
			});
			it('Should reject users with non-string username', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username: 1234,
						password,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Incorrect field type: expected string');
						expect(res.body.location).to.equal('username');
					});
			});
			it('Should reject users with a non-string password', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password: 1234,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Incorrect field type: expected string');
						expect(res.body.location).to.equal('password');
					});
			});
			it('Should reject invalid email', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password,
						email: 'testify'
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Must be a valid email address');
						expect(res.body.location).to.equal('email');
					});
			});
			it('Should reject users with non-trimmed username', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username: ` ${username} `,
						password,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Cannot start or end with whitespace');
						expect(res.body.location).to.equal('username');
					});
			});
			it('Should reject users with a non-trimmed password', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password: ` ${password} `,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Cannot start or end with whitespace');
						expect(res.body.location).to.equal('password');
					});
			});
			it('Should reject users with empty username', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username: '',
						password,
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Must be at least 1 characters long');
						expect(res.body.location).to.equal('username');
					});
			});
			it('Should reject users with with password less than ten characters', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password: '12345',
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed')
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Must be at least 6 characters long');
						expect(res.body.location).to.equal('password');
					});
			});
			it('Should reject users with password greater than 72 characters', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password: new Array(73).fill('a').join(''),
						email
					})
					.then(() => {
						expect.fail(null, null, 'Request should not succeed');
					})
					.catch(err => {
						if(err instanceof chai.AssertionError) {
							throw err;
						}
						const res = err.response;
						expect(res).to.have.status(422);
						expect(res.body.reason).to.equal('ValidationError');
						expect(res.body.message).to.equal('Must be at most 72 characters long');
						expect(res.body.location).to.equal('password');
					});
			});
			it('Should reject users with duplicate username', function() {
				return User.create({
					username,
					password,
					email
				})
				.then(() => {
					return chai
						.request(app)
						.post('/users')
						.send({
							username,
							password,
							email
						})
				})
				.then(() => {
					expect.fail(null, null, 'Request should not succeed')
				})
				.catch(err => {
					if(err instanceof chai.AssertionError) {
						throw err;
					}
					const res = err.response;
					expect(res).to.have.status(422);
					expect(res.body.reason).to.equal('ValidationError');
					expect(res.body.message).to.equal('Username already taken');
					expect(res.body.location).to.equal('username');
				});
			});
			it('Should create a new user', function() {
				return chai
					.request(app)
					.post('/users')
					.send({
						username,
						password,
						email
					})
					.then(res => {
						expect(res).to.have.status(201);
						expect(res.body).to.be.an('object');
						expect(res.body).to.have.keys('username', 'email');
						expect(res.body.username).to.equal(username);
						expect(res.body.email).to.equal(email);
						return User.findOne({
							username
						});
					})
					.then(user => {
						expect(user).to.not.be.null;
						expect(user.email).to.equal(email);
						return user.validatePassword(password);
					})
					.then(passwordIsCorrect => {
						expect(passwordIsCorrect).to.be.true;
					});
			});

		})
	})
})