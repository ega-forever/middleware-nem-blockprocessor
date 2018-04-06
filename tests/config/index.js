require('dotenv').config();
const config = require('../../config');

config['dev'] = {
    privateKey: process.env.PRIVATE_KEY || '',
    accounts: [process.env.ADDRESS_ONE ,process.env.ADDRESS_TWO]
}

module.exports =  config;