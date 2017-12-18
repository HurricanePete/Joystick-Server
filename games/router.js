const express = require('express');
const bodyParser = require('body-parser');

const config = require('../config');
const router = express.Router();

const igdb = require('igdb-api-node').default;

const client = igdb(config.IGDB_API_KEY);

router.use(bodyParser.json());
router.get('/search/:search', (req, res) => {
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
            fields: ['name', 'cover', 'rating'],
            filter: "platforms",
            lt: 50,
            limit: 25
        })
        .then(games => {
            res.setHeader('Cache-Control', 'public, max-age=180')
            res.status(200).json(games.body)
        })
    })
    .catch(err => {
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
                else if(platform.id <= 41 || platform.id >= 48 || platform.id === 46) {
                    responseObject.platforms.push(platform.name)
                }
            })
            responseObject.platforms = responseObject.platforms.filter(platform => platform !== "iOS");
            res.status(200).json(responseObject);
        })
    })
    .catch(err => {
        res.status(500).json({error: 'Something went wrong'})
    })
})

router.get('/news', (req, res) => {
    const today = new Date();
    const timeFrame = Date.parse(today);
    client.pulses({
        order:'published_at:desc',
        filters: {
            'published_at-lt': timeFrame
        }
    })
    .then(articles => {
        const newsIds = articles.body.map(article => {
            return article.id;
        });
        client.pulses({
            ids: newsIds,
            fields: ['title', 'image', 'published_at', 'url', 'pulse_source.name'],
            expand: ['pulse_source']
        })
        .then(news => {
            res.status(200).json(news.body)
        })
    })
})

module.exports = {router};