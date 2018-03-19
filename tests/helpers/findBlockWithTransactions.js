const nis = require('../../services/nisRequestService');

module.exports = async (height, blockHeight) => {
  const findBlock = async (height) => {
    let block = await nis.getBlock(blockHeight + height);
    if (block.transactions.length === 0) {
      console.log('try height ' + height);
      return await findBlock(height + 1);
    }
    return block;
  };
  return await findBlock();
};