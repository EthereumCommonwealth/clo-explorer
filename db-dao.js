const { Schema, model } = require('mongoose');

const DAOCreatedToken = new Schema({
  'transactionHash': { type: String, index: { unique: true } },
  'blockNumber': { type: Number, index: { unique: false } },
  'amount': String,
  'to': String,
  'timestamp': Number,
});

const DAOTransferToken = new Schema({
  'transactionHash': { type: String, index: { unique: true } },
  'blockNumber': { type: Number, index: { unique: false } },
  'amount': String,
  'to': String,
  'from': String,
  'timestamp': Number,
});

model('DAOCreatedToken', DAOCreatedToken);
model('DAOTransferToken', DAOTransferToken);
module.exports.DAOCreatedToken = model('DAOCreatedToken');
module.exports.DAOTransferToken = model('DAOTransferToken');
