const express = require('express');
const bodyParser = require('body-parser');
const request = require('request-promise-native');

const config = require('../config');
const router = express.Router();

const {OperationHelper} = require('apac');
const apac = new OperationHelper({
    awsId: `${config.AWS_ID}`,
    awsSecret: `${config.AWS_SECRET}`,
    assocId: `${config.AWS_ASSOC_ID}`
});

router.use(bodyParser.json());
//attempts to find a match to the requested game on the Amazon and eBay apis
router.post('/', (req, res) => {
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
            return 'empty';
        }
        else {
//cross-checks matched Amazon games with the release data -- feaure needs to be expanded
            const matches = resultArray.Item.filter(item => item.ItemAttributes.Platform === req.body.console);
            if(matches.length === 0) {
                return 'empty';
            }
            else {
                let closest = matches[0];
                matches.forEach(item => {
                    const requestYear = new Date(req.body.releaseDate).getFullYear();
                    const gameYear = new Date(item.ItemAttributes.ReleaseDate).getFullYear();
                    if(Math.abs(requestYear - gameYear) < closest) {
                        closest = item
                    }
                })
                const gameResponse = {
                   url: closest.DetailPageURL,
                    attributes: closest.ItemAttributes,
                    pricing: closest.OfferSummary
                };
                priceResponse.amazon = gameResponse;
                const matchUpc = closest.ItemAttributes.UPC;
                return matchUpc === undefined ? 'empty' : matchUpc ;
            }
        }
    })
//attempts to use the UPC from the Amazon result to find a matching item on eBay
    .then(upc => {
        if(upc === 'empty') {
            res.status(200).json(priceResponse); 
        }
        else {
            const options = {
                uri: `http://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByProduct&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${config.EBAY_CLIENT_ID}&RESPONSE-DATA-FORMAT=JSON&REST-PAYLOAD&productId.@type=UPC&productId=${upc}`,
                json: true
            }
            request(options)
            .then(results => {
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

module.exports = {router};