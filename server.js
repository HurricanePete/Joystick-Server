require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');

// Here we use destructuring assignment with renaming so the two variables
// called router (from ./users and ./auth) have different names
// For example:
// const actorSurnames = { james: "Stewart", robert: "De Niro" };
// const { james: jimmy, robert: bobby } = actorSurnames;
// console.log(jimmy); // Stewart - the variable name is jimmy, not james
// console.log(bobby); // De Niro - the variable name is bobby, not robert
const {router: usersRouter, User, Watchlist} = require('./users');
const {router: authRouter, basicStrategy, jwtStrategy} = require('./auth');


mongoose.Promise = global.Promise;

const {PORT, DATABASE_URL} = require('./config');

const app = express();

app.use(bodyParser.json());

// Logging
app.use(morgan('common'));

// CORS
app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    if (req.method === 'OPTIONS') {
        return res.send(204);
    }
    next();
});

app.use(passport.initialize());
passport.use(basicStrategy);
passport.use(jwtStrategy);

app.use('/users/', usersRouter);
app.use('/auth/', authRouter);

app.get('/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    return User
    .find(req.user)
    .exec()
    .then(user => {
        return Watchlist
            .find(user._id)
            .exec()
            .then(userList => {
                console.log(userList[0].gameIds);
                res.json(userList[0]);
            })
    })    
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
    })
})

app.put('/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    if (!("gameIds" in req.body)) {
      const message = "Missing gameIds in request body";
      console.error(message);
      return res.status(400).send(message);
    }
    User
    .find(req.user)
    .exec()
    .then(user => {
        console.log("user id: " + user[0]._id);
        return user[0]._id;
    })
    .then(id => {
        console.log(id);
        return Watchlist
        .find({userId: id})
        .exec()
        .then(item => {
            console.log(item);
            return item[0];
        })
    })
    .then(list => {
        console.log(list);
        return Watchlist
        .findByIdAndUpdate(list._id, {$set: {gameIds: req.body.gameIds}}, {new: true})
        .exec()
        .then(updatedList => res.status(201).json(updatedList))
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
    })
})

app.use('*', (req, res) => {
    return res.status(404).json({message: 'Not Found'});
});

// Referenced by both runServer and closeServer. closeServer
// assumes runServer has run and set `server` to a server object
let server;

function runServer(databaseUrl=DATABASE_URL, port=PORT) {
    return new Promise((resolve, reject) => {
        mongoose.connect(databaseUrl, err => {
            if (err) {
                return reject(err);
            }
            server = app
                .listen(port, () => {
                    console.log(`Your app is listening on port ${port}`);
                    resolve();
                })
                .on('error', err => {
                    mongoose.disconnect();
                    reject(err);
                });
        });
    });
}

function closeServer() {
    return mongoose.disconnect().then(() => {
        return new Promise((resolve, reject) => {
            console.log('Closing server');
            server.close(err => {
                if (err) {
                    return reject(err);
                }
                resolve();
            });
        });
    });
}

if (require.main === module) {
    runServer().catch(err => console.error(err));
}

module.exports = {app, runServer, closeServer};
