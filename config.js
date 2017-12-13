exports.DATABASE_URL = process.env.DATABASE_URL || global.DATABASE_URL || 'mongodb://localhost/joystick-informer';
exports.PORT = process.env.PORT || 8080;
exports.JWT_SECRET = process.env.JWT_SECRET;
exports.JWT_EXPIRY = process.env.JWT_EXPIRY || '7d';

exports.CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

exports.IGDB_API_KEY = process.env.IGDB_API_KEY;

exports.AWS_ID = process.env.AWS_ID;
exports.AWS_SECRET = process.env.AWS_SECRET;
exports.AWS_ASSOC_ID = process.env.AWS_ASSOC_ID;

exports.EBAY_CLIENT_ID = process.env.EBAY_CLIENT_ID;
exports.EBAY_DEV_ID = process.env.EBAY_DEV_ID;
exports.EBAY_SECRET = process.env.EBAY_SECRET;