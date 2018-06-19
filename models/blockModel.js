/**
 * Mongoose model. Represents a block in nem
 * @module models/blockModel
 * @returns {Object} Mongoose model
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
*/

/**
 * Mongoose model. Represents a block in nem
 * @module models/blockModel
 * @returns {Object} Mongoose model
 */

const mongoose = require('mongoose'),
  config = require('../config');

/**
 * Mongoose model. Represents a block in nem
 * @module models/blockModel
 * @returns {Object} Mongoose model
 */

const Block = new mongoose.Schema({
  _id: {type: String},
  number: {type: Number, unique: true, index: true},
  timestamp: {type: Number, required: true, index: true},
  signer: {type: String}
}, {_id: false});

module.exports = ()=>
  mongoose.model(`${config.mongo.data.collectionPrefix}Block`, Block);
