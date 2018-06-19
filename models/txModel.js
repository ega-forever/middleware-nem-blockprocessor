/**
 * Mongoose model. Represents a transaction in nem
 * @module models/txModel
 * @returns {Object} Mongoose model
 *
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Vesrsion 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
 */

const mongoose = require('mongoose'),
  config = require('../config');

require('mongoose-long')(mongoose);

const TX = new mongoose.Schema({
  _id: {type: String},
  blockNumber: {type: Number, required: true, index: true, default: -1},
  timestamp: {type: Number, required: true, index: true, default: Date.now},
  amount: {type: mongoose.Schema.Types.Long, index: true},
  recipient: {type: String, index: true},
  sender: {type: String, index: true},
  fee: {type: mongoose.Schema.Types.Long},
  messagePayload: {type: String},
  messageType: {type: Number},
  mosaics: [{
    quantity: {type: mongoose.Schema.Types.Long},
    type: {type: String},
    supplyType: {type: String},
    delta: {type: String},
    fee: {type: mongoose.Schema.Types.Long},
    deadline: {type: String},
    version: {type: Number},
    timestamp: {type: Number},
    mosaicId: {
      namespaceId: {type: String},
      name: {type: String}
    }
  }]
}, {_id: false});

module.exports = () =>
  mongoose.model(`${config.mongo.data.collectionPrefix}TX`, TX);
