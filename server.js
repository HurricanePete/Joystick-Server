require('dotenv').config();
const bodyParser = require('body-parser');
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const passport = require('passport');
const request = require('request-promise-native');

const {PORT, DATABASE_URL, IGDB_API_KEY, AWS_ID, AWS_SECRET, AWS_ASSOC_ID, EBAY_CLIENT_ID} = require('./config');

const igdb = require('igdb-api-node').default;

const {OperationHelper} = require('apac');
const apac = new OperationHelper({
    awsId: `${AWS_ID}`,
    awsSecret: `${AWS_SECRET}`,
    assocId: `${AWS_ASSOC_ID}`
});

const {router: usersRouter, User, Watchlist} = require('./users');
const {router: authRouter, localStrategy, jwtStrategy} = require('./auth');

mongoose.Promise = global.Promise;

const client = igdb(IGDB_API_KEY);

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
        throw err;
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

//add 'expand' to eliminate nested promises
app.get('/games/search/:search', (req, res) => {
    client.games({
        search: req.params.search
    })
    .then(results => {
        const resultIds = results.body.map(item => {
            return item.id
        });
        resultIds.join(',');
        client.games({
            ids: resultIds,
            limit: 25,
            scroll: 1
        }, ['name', 'cover', 'rating'])
        .then(games => {
            res.setHeader('Cache-Control', 'public, max-age=180')
            res.status(200).json(games.body)
        })
    })
    .catch(err => {
        throw err;
    })
})

app.get('/games/ids/:id', (req, res) => {
    client.games({
        ids: new Array(req.params.id)
    }, ['name', 'cover', 'rating'])
    .then(games => {
        console.log('Game search successful');
        res.status(200).json(games);
    })
    .catch(err => {
        throw err;
    })
})

app.get('/games/single/:id', (req, res) => {
    client.games({
        ids: new Array(req.params.id)
    })
    .then(game => {
        console.log('Game search successful');
        res.status(200).json(game.body[0]);
    })
    .catch(err => {
        throw err;
    })
})

//attempts to find a match to the requested game on the Amazon and eBay apis
app.post('/pricing', (req, res) => {
    let priceResponse = {
        amazon: null,
        ebay: null
    }
    apac.execute('ItemSearch', {
            'SearchIndex': 'VideoGames',
            'Keywords': req.body.search,
            'ResponseGroup': 'ItemAttributes,Medium'
    })
    .then(results => {
        const resultArray = results.result.ItemSearchResponse.Items;
        if(resultArray.TotalResults === '0') {
            res.status(200).json({message: 'No results found'})
            Promise.reject(new Error('No results'));
        }
        else {
        //console.log(resultArray)
//cross-checks matched Amazon games with the release data -- feaure needs to be expanded
            const matches = resultArray.Item.filter(item => item.ItemAttributes.HardwarePlatform === req.body.console);
            console.log("Matching console", matches);
            if(matches.length === 0) {
                return 'empty';
            }
            else {
                const timeFrame = item => {
                    console.log('TimeFrame is:', Math.abs((Date.parse(item.ItemAttributes.ReleaseDate)) - req.body.ReleaseDate) <= 15883200000);
                    return Math.abs((Date.parse(item.ItemAttributes.ReleaseDate)) - req.body.releaseDate) <= 15883200000;
                };
                const refinedMatches = matches.filter(item => timeFrame(item));
                console.log("Matching timeframe", refinedMatches)
                if(refinedMatches.length === 0) {
                    return 'empty';
                }
                else {
                    const gameResponse = {
                        url: refinedMatches[0].DetailPageURL,
                        attributes: refinedMatches[0].ItemAttributes,
                        pricing: refinedMatches[0].OfferSummary
                    };
                    priceResponse.amazon = gameResponse;
                    console.log(refinedMatches[0].ItemAttributes.UPC)
                    const matchUpc = refinedMatches[0].ItemAttributes.UPC;
                    return matchUpc === undefined ? 'empty' : matchUpc ;
                }
            }
        }
    })
//attempts to use the UPC from the Amazon result to find a matching item on eBay
    .then(upc => {
        if(upc === 'empty') {
            res.status(200).json(priceResponse); 
        }
        else {
            console.log('pre-Ebay', upc)
            const options = {
                uri: `http://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByProduct&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${EBAY_CLIENT_ID}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&productId.@type=UPC&productId=${upc}`,
                json: true
            }
            request(options)
            .then(results => {
                console.log(results.findItemsByProductResponse);
                if(results.findItemsByProductResponse[0].ack[0] === 'Failure') {
                    res.status(200).json(priceResponse);
                }
                else {
                    const match = results.findItemsByProductResponse[0].searchResult[0].item[0];
                    const gameResponse = {
                        url: match.viewItemURL[0],
                        attributes: {
                            title: match.title[0],
                            condition: match.condition[0]
                        },
                        pricing: match.sellingStatus[0],
                        buyItNow: match.listingInfo[0].buyItNowAvailable[0]
                    }
                    priceResponse.ebay = gameResponse;
                    res.status(200).json(priceResponse);
                }
            })
        }
    })
    .catch(err => {
        res.status(500).json({error: 'Something went wrong'})
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
