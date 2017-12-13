require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');

const igdb = require('igdb-api-node').default;

const {PORT, DATABASE_URL, IGDB_API_KEY} = require('./config');

const {router: usersRouter, User, Watchlist} = require('./users');
const {router: authRouter, localStrategy, jwtStrategy} = require('./auth');
const {router: pricingRouter} = require('./pricing');
const {router: gameSearchRouter} = require('./games');

const client = igdb(IGDB_API_KEY);

mongoose.Promise = global.Promise;

const app = express();

app.use(bodyParser.json());

app.use(morgan('common'));

app.use(function(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(passport.initialize());
passport.use(localStrategy);
passport.use(jwtStrategy);

app.use('/users/', usersRouter);
app.use('/auth/', authRouter);
app.use('/pricing/', pricingRouter);
app.use('/games/', gameSearchRouter);

app.get('/api/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    return User
    .find(req.user)
    .exec()
    .then(user => {
        console.log(user[0]._id)
        return Watchlist
            .find({userId: user[0]._id})
            .exec()
            .then(userList => {
                console.log(userList)
                res.json(userList[0]);
            })
    })    
    .catch(err => {
        console.error(err);
        res.sendStatus(500).json({error: 'Something went wrong'});
    })
})

//uses an updated watchlist to generate an array of five related game IDs that will update each time the watchlist is updated
const populateRelated = watchlist => {
    const watchlistArray = Array.from(watchlist);
    return client.games({
        ids: watchlistArray
    })
    .then(watchlistGames => {
        let relatedGames = [];
        while(relatedGames.length < 5) {
            const randomWatchlistIndex = Math.floor(Math.random() * watchlistGames.body.length);
            const relatedArray = watchlistGames.body[randomWatchlistIndex].games;
            const randomRelatedId = Math.floor(Math.random() * relatedArray.length);
            const doesContain = relatedGames.includes(relatedArray[randomRelatedId]) || watchlistArray.includes(relatedArray[randomRelatedId]);
            if(doesContain) {
                console.log('continuing')
                continue;
            }
            console.log('pushing')
            relatedGames.push(relatedArray[randomRelatedId]);
        }
        console.log(watchlistArray)
        console.log(relatedGames)
        return relatedGames
    })
    .catch(err => {
        res.status(500).json({error: 'Something went wrong'})
    })
}

app.put('/api/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    if (!("gameIds" in req.body)) {
      const message = "Missing gameIds in request body";
      console.error(message);
      return res.sendStatus(400).json({message});
    }
    User
    .find(req.user)
    .exec()
    .then(user => {
        return user[0]._id;
    })
    .then(id => {
        return Watchlist
        .find({userId: id})
        .exec()
        .then(item => {
            return item[0];
        })
    })
    .then(list => {
            if(req.body.gameIds.length === 0) {
                console.log('Firing')
                return Watchlist
                        .findByIdAndUpdate(list._id, {$set: {gameIds: req.body.gameIds, relatedIds: []}}, {new: true})
                        .exec()
                        .then(updatedList => {
                            console.log('Related Ids should be empty')
                            res.status(201).json(updatedList)
                        })
                        

            }
            else {
                const relatedList = populateRelated(req.body.gameIds)
                .then(relatedGames => {
                    console.log('RelatedGames worked')
                    return Watchlist
                        .findByIdAndUpdate(list._id, {$set: {gameIds: req.body.gameIds, relatedIds: relatedGames}}, {new: true})
                        .exec()
                        .then(updatedList => res.status(201).json(updatedList))
                    })

            }
                   
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
    })
})

app.use('*', (req, res) => {
    return res.status(404).json({message: 'Not Found'});
});


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
