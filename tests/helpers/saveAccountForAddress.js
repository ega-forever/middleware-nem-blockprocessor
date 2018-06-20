/** 
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
* @author Kirill Sergeev <cloudkserg11@gmail.com>
*/
const models = require('../../models');
module.exports = async (account) => {
  return await models.accountModel.update({address: account}, {$set: {address: account}}, {
    upsert: true,
    setDefaultsOnInsert: true
  });
};
