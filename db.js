const {
  Schema, model, connect, set,
} = require('mongoose');

const Block = new Schema({
  'number': { type: Number, index: { unique: true } },
  'hash': String,
  'parentHash': String,
  'nonce': String,
  'sha3Uncles': String,
  'logsBloom': String,
  'transactionsRoot': String,
  'stateRoot': String,
  'receiptRoot': String,
  'miner': { type: String, lowercase: true },
  'difficulty': String,
  'totalDifficulty': String,
  'size': Number,
  'extraData': String,
  'gasLimit': Number,
  'gasUsed': Number,
  'timestamp': Number,
  'blockTime': Number,
  'uncles': [String],
});

const Account = new Schema({
  'address': { type: String, index: { unique: true } },
  'balance': Number,
  'blockNumber': Number,
  'type': Number, // address: 0x0, contract: 0x1
});

const Contract = new Schema({
  'address': { type: String, index: { unique: true } },
  'creationTransaction': String,
  'contractName': String,
  'compilerVersion': String,
  'optimization': Boolean,
  'sourceCode': String,
  'abi': String,
  'byteCode': String,
}, { collection: 'Contract' });

const Transaction = new Schema({
  'hash': { type: String, index: { unique: true }, lowercase: true },
  'nonce': Number,
  'blockHash': String,
  'blockNumber': Number,
  'transactionIndex': Number,
  'from': { type: String, lowercase: true },
  'to': { type: String, lowercase: true },
  'creates': { type: String, lowercase: true },
  'value': String,
  'gas': Number,
  'gasUsed': Number,
  'gasPrice': String,
  'timestamp': Number,
  'input': String,
  'status': Number,
}, { collection: 'Transaction' });

const BlockStat = new Schema({
  'number': { type: Number, index: { unique: true } },
  'timestamp': Number,
  'difficulty': String,
  'hashrate': String,
  'txCount': Number,
  'gasUsed': Number,
  'gasLimit': Number,
  'miner': String,
  'blockTime': Number,
  'uncleCount': Number,
});

const Market = new Schema({
  'symbol': String,
  'timestamp': Number,
  'quoteBTC': Number,
  'quoteUSD': Number,
});

// create indices
Transaction.index({ timestamp: -1 });
Transaction.index({ blockNumber: -1 });
Transaction.index({ from: 1, blockNumber: -1 });
Transaction.index({ to: 1, blockNumber: -1 });
Transaction.index({ creates: 1, blockNumber: -1 });
Account.index({ balance: -1 });
Account.index({ balance: -1, blockNumber: -1 });
Block.index({ miner: 1 });
Market.index({ timestamp: -1 });
model('BlockStat', BlockStat);
model('Block', Block);
model('Account', Account);
model('Contract', Contract);
model('Transaction', Transaction);
model('Market', Market);
module.exports.BlockStat = model('BlockStat');
module.exports.Block = model('Block');
module.exports.Contract = model('Contract');
module.exports.Transaction = model('Transaction');
module.exports.Account = model('Account');
module.exports.Market = model('Market');

connect(process.env.MONGO_URI || 'mongodb://localhost/blockDB');

// set('debug', true);
