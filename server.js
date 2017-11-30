require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');

const igdb = require('igdb-api-node').default;

const {router: usersRouter, User, Watchlist} = require('./users');
const {router: authRouter, localStrategy, jwtStrategy} = require('./auth');

mongoose.Promise = global.Promise;

const {PORT, DATABASE_URL, IGDB_API_KEY} = require('./config');

const client = igdb(IGDB_API_KEY);

const app = express();

app.use(bodyParser.json());

app.use(morgan('common'));

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
passport.use(localStrategy);
passport.use(jwtStrategy);

app.use('/users/', usersRouter);
app.use('/auth/', authRouter);

app.get('/api/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    return User
    .find(req.user)
    .exec()
    .then(user => {
        return Watchlist
            .find(user._id)
            .exec()
            .then(userList => {
                res.json(userList[0]);
            })
    })    
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
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
            if(!(relatedGames.includes(randomRelatedId))) {
                relatedGames.push(relatedArray[randomRelatedId]);
            }
        }
        return relatedGames
    })
    .catch(err => {
        throw err;
    })
}

app.put('/api/dashboard', passport.authenticate('jwt', {session:false}), (req, res) => {
    if (!("gameIds" in req.body)) {
      const message = "Missing gameIds in request body";
      console.error(message);
      return res.status(400).send(message);
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
        const relatedList = populateRelated(req.body.gameIds);
        return relatedList
        .then(relatedList => {
            return Watchlist
            .findByIdAndUpdate(list._id, {$set: {gameIds: req.body.gameIds, relatedIds: relatedList}}, {new: true})
            .exec()
            .then(updatedList => res.status(201).json(updatedList))
        })
    })
    .catch(err => {
        console.error(err);
        res.status(500).json({error: 'Something went wrong'});
    })
})

//add 'expand' to eliminate nested promises
app.get('/games/:search', (req, res) => {
    client.games({
        search: req.params.search
    })
    .then(results => {
        const resultIds = results.body.map(item => {
            return item.id
        });
        resultIds.join(',');
        client.games({
            ids: resultIds
        })
        .then(games => {
            res.setHeader('Cache-Control', 'public, max-age=180')
            res.send(games.body)
        })
    })
    .catch(err => {
        throw err;
    })
})

app.get('/games/single/:id', (req, res) => {
    client.games({
        ids: req.params.id
    })
    .then(game => {
        res.send(game.body)
    })
    .catch(err => {
        throw err;
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
