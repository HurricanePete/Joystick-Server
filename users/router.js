const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');

const {User, Watchlist} = require('./models');

const router = express.Router();

const jsonParser = bodyParser.json();

router.post('/', jsonParser, (req, res) => {
    const requiredFields = ['username', 'password', 'email'];
    const missingField = requiredFields.find(field => !(field in req.body));

    if (missingField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Missing field',
            location: missingField
        });
    }

    const stringFields = ['username', 'password', 'email'];
    const nonStringField = stringFields.find(
        field => field in req.body && typeof req.body[field] !== 'string'
    );

    if (nonStringField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Incorrect field type: expected string',
            location: nonStringField
        });
    }
    const explicityTrimmedFields = ['username', 'password'];
    const nonTrimmedField = explicityTrimmedFields.find(
        field => req.body[field].trim() !== req.body[field]
    );

    if (nonTrimmedField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Cannot start or end with whitespace',
            location: nonTrimmedField
        });
    }

    const sizedFields = {
        username: {
            min: 1
        },
        password: {
            min: 6,
            // bcrypt truncates after 72 characters
            max: 72
        }
    };
    const tooSmallField = Object.keys(sizedFields).find(
        field =>
            'min' in sizedFields[field] &&
            req.body[field].trim().length < sizedFields[field].min
    );
    const tooLargeField = Object.keys(sizedFields).find(
        field =>
            'max' in sizedFields[field] &&
            req.body[field].trim().length > sizedFields[field].max
    );

    if (tooSmallField || tooLargeField) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: tooSmallField
                ? `must be at least ${sizedFields[tooSmallField]
                      .min} characters long`
                : `must be at most ${sizedFields[tooLargeField]
                      .max} characters long`,
            location: tooSmallField || tooLargeField
        });
    }

    const emailFields = ['email'];
    const invalidEmail = emailFields.find(
        field => !(req.body[field].includes('@'))
    );

     if (invalidEmail) {
        return res.status(422).json({
            code: 422,
            reason: 'ValidationError',
            message: 'Must be a valid email address',
            location: invalidEmail
        });
    }

    let {username, password, email} = req.body;
    email = email.trim();

    return User.find({username})
        .count()
        .then(count => {
            if (count > 0) {
                return Promise.reject({
                    code: 422,
                    reason: 'ValidationError',
                    message: 'Username already taken',
                    location: 'username'
                });
            }
            return User.hashPassword(password);
        })
        .then(hash => {
            return User.create({
                username,
                password: hash,
                email
            });
        })
        .then(user => {
            Watchlist.create({
                userId: user._id
            });
            return res.status(201).json(user.apiRepr());
        })
        .catch(err => {
            console.log(err);
            if (err.reason === 'ValidationError') {
                return res.status(err.code).json(err);
            }
            res.status(500).json({code: 500, message: 'Internal server error'});
        });
});

module.exports = {router};
