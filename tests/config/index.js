/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
require('dotenv').config();
const config = require('../../config');

config['dev'] = {
  httpForTransaction: process.env.DEV_HTTP_FOR_TRANSACTION || 'http://192.3.61.243:7890',
  privateKey: process.env.PRIVATE_KEY || '',
  accounts: [process.env.ADDRESS_ONE ,process.env.ADDRESS_TWO]
};

module.exports =  config;
