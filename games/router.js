const express = require('express');
const bodyParser = require('body-parser');

const config = require('../config');
const router = express.Router();

const igdb = require('igdb-api-node').default;

const client = igdb(config.IGDB_API_KEY);

router.use(bodyParser.json());
router.get('/search/:search', (req, res) => {
    const validPlatforms = () => {
        let platformArray = [];
        for(let i=1; i<=50; i++) {
            if(i !== 15 || i !== 16 || i !== 25 || i !== 26 || i !== 27 || i !== 40 || i !== 42 || i !== 44) {
                platformArray.push(i);
            }
        }
        return platformArray;
    }
    const platformList = validPlatforms();
    client.games({
        search: req.params.search
    })
    .then(results => {
//creates a list of valid platform ids in order to filter queries from IGDB
        const resultIds = results.body.map(item => {
            return item.id
        });
        resultIds.join(',');
        client.games({
            ids: resultIds,
            order: 'release_dates.date:desc',
            filters: {
                'in': platformList
            },
            expand: ['genres'],
            limit: 25
        }, ['name', 'cover', 'genres.name', 'first_release_date', ])
        .then(games => {
            res.setHeader('Cache-Control', 'public, max-age=180')
            res.status(200).json(games.body)
        })
    })
    .catch(err => {
        console.log(err)
        res.status(500).json({error: 'Something went wrong'})
    })
})

router.get('/ids/:id', (req, res) => {
    client.games({
        ids: new Array(req.params.id)
    }, ['name', 'cover', 'rating'])
    .then(games => {
        res.status(200).json(games);
    })
    .catch(err => {
        res.status(500).json({error: 'Something went wrong'})
    })
})

router.get('/single/:id', (req, res) => {
    let responseObject = {
        game: null,
        platforms: []
    }
    client.games({
        ids: new Array(req.params.id)
    })
    .then(game => {
        responseObject.game = game.body[0];
        client.platforms({
            ids: new Array(game.body[0].platforms)
        }, ['name'])
        .then(platforms => {
//filters out additional platforms that may be included despite the igdb api call parameters
            platforms.body.forEach(platform => {
                if(platform.id === 6) {
                    responseObject.platforms.push("PC")
                }
            })
            res.status(200).json(responseObject);
        })
    })
    .catch(err => {
        res.status(500).json({error: 'Something went wrong'})
    })
})

module.exports = {router};