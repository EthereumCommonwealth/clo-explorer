#!/usr/bin/env node

/*
    Endpoint for client interface with ERC-20 tokens
*/

require('../db.js');

const mongoose = require('mongoose');

const Contract = mongoose.model('Contract');
const Transaction = mongoose.model('Transaction');

const BigNumber = require('bignumber.js');

const etherUnits = require(`${__lib}etherUnits.js`);
const async = require('async');
const abiDecoder = require('abi-decoder');
const { web3 } = require('./web3relay');
const { eth } = require('./web3relay');
const { filterTrace } = require('./filters');

const ABI = [{
  'constant': true, 'inputs': [], 'name': 'name', 'outputs': [{ 'name': '', 'type': 'string' }], 'payable': false, 'type': 'function',
}, {
  'constant': true, 'inputs': [], 'name': 'totalSupply', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'payable': false, 'type': 'function',
}, {
  'constant': true, 'inputs': [], 'name': 'decimals', 'outputs': [{ 'name': '', 'type': 'uint8' }], 'payable': false, 'type': 'function',
}, {
  'constant': true, 'inputs': [{ 'name': '', 'type': 'address' }], 'name': 'balanceOf', 'outputs': [{ 'name': '', 'type': 'uint256' }], 'payable': false, 'type': 'function',
}, {
  'constant': true, 'inputs': [], 'name': 'symbol', 'outputs': [{ 'name': '', 'type': 'string' }], 'payable': false, 'type': 'function',
}, {
  'constant': false, 'inputs': [{ 'name': 'to', 'type': 'address' }, { 'name': 'tokens', 'type': 'uint256' }], 'name': 'transfer', 'outputs': [{ 'name': 'success', 'type': 'bool' }], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function',
}];

const MAX_ENTRIES = 20;

module.exports = function (req, res) {
  console.log(req.body);
  if (!('action' in req.body)) {
    res.status(400).send();
    return;
  }

  const contractAddress = req.body.address.toLowerCase();

  async.waterfall([
    function (callback) {
      // get the creation transaction.
      Transaction.findOne({ creates: contractAddress }).lean(true).exec((err, doc) => {
        if (err || !doc) {
          // no transaction found.
          callback({ error: 'true', message: 'no transaction found' }, null);
          return;
        }
        callback(null, doc);
      });
    },
    function (transaction, callback) {
      Contract.findOne({ address: contractAddress }).lean(true)
        .exec((err, doc) => {
          let contract;
          if (err || !doc) {
            console.log('Contract not found. use default abi.');
            contract = eth.contract(ABI);
          } else {
            try {
              contract = eth.contract(JSON.parse(doc.abi));
            } catch (e) {
              console.log('JSON parse error. use default abi.');
              contract = eth.contract(ABI);
            }
          }
          const token = contract.at(contractAddress);
          callback(null, transaction, contract, token);
        });
    },
  ], (error, transaction, contract, token) => {
    if (error) {
      console.error('Error :', error);
      res.write(JSON.stringify(error));
      res.end();
      return;
    }
    if (req.body.action === 'info') {
      let decimals = 0;
      try {
        decimals = token.decimals ? token.decimals() : 0;
      } catch (e) {
        decimals = 0;
      }
      try {
        let actualBalance = eth.getBalance(contractAddress);
        actualBalance = etherUnits.toEther(actualBalance, 'wei');
        let totalSupply = token.totalSupply();
        const name = token.name();
        const symbol = token.symbol();
        const count = eth.getTransactionCount(contractAddress);

        // convert totalSupply unit
        const decimalsBN = new BigNumber(decimals);
        const divisor = new BigNumber(10).pow(decimalsBN);
        totalSupply = totalSupply.dividedBy(divisor);

        const tokenData = {
          'balance': actualBalance,
          'total_supply': totalSupply,
          'count': count,
          'name': name,
          'symbol': symbol,
          'creator': transaction.from,
          'transaction': transaction.hash,
          'timestamp': transaction.timestamp,
          'decimals': decimals,
          'bytecode': eth.getCode(contractAddress),
        };
        res.write(JSON.stringify(tokenData));
        res.end();
      } catch (e) {
        console.error(e);
      }
    } else if (req.body.action === 'balanceOf') {
      const addr = req.body.user.toLowerCase();
      let decimals = 0;
      try {
        decimals = token.decimals ? token.decimals() : 0;
      } catch (e) {
        decimals = 0;
      }
      try {
        let tokens = token.balanceOf(addr);
        const decimalsBN = new BigNumber(decimals);
        const divisor = new BigNumber(10).pow(decimalsBN);
        tokens = tokens.dividedBy(divisor);
        res.write(JSON.stringify({ 'tokens': tokens }));
        res.end();
      } catch (e) {
        let tokens = token.balanceOf(addr);
        const decimalsBN = new BigNumber(decimals);
        const divisor = new BigNumber(10).pow(decimalsBN);
        tokens = tokens.dividedBy(divisor);
        res.write(JSON.stringify({ 'tokens': tokens }));
        res.end();
      }
    } else if (req.body.action === 'transfer') {
      let after = 0;
      if (req.body.after) {
        after = parseInt(req.body.after);
        if (after < 0) {
          after = 0;
        }
      }

      const addr = req.body.address.toLowerCase();
      abiDecoder.addABI(contract.abi);

      // convert token unit
      let decimals = 0;
      try {
        decimals = token.decimals ? token.decimals() : 0;
      } catch (e) {
        decimals = 0;
      }
      const decimalsBN = new BigNumber(decimals);
      const divisor = new BigNumber(10).pow(decimalsBN);

      let fromBlock = transaction.blockNumber;
      fromBlock = web3.toHex(fromBlock);
      const filter = { 'fromBlock': fromBlock, 'toAddress': [addr], 'count': MAX_ENTRIES };

      if (after) {
        filter.after = after;
      }
      web3.trace.filter(filter, (err, tx) => {
        if (err || !tx) {
          console.error(`TraceWeb3 error :${err}`);
          res.write(JSON.stringify({ 'error': true }));
        } else {
          const txns = filterTrace(tx);
          const transfers = [];
          txns.forEach((t) => {
            if (t.type === 'call') {
              const callInfo = abiDecoder.decodeMethod(t.action.input);
              if (callInfo && callInfo.name && callInfo.name === 'transfer') {
              // convert amount
                const amount = new BigNumber(callInfo.params[1].value);
                t.amount = amount.dividedBy(divisor);
                // replace to address with _to address arg
                t.to = callInfo.params[0].value;
                t.callInfo = callInfo;
                transfers.push(t);
              }
            }
          });
          res.write(JSON.stringify({ transfer: transfers, after, count: filter.count }));
        }
        res.end();
      });
    } else if (req.body.action === 'transaction') {
      const addr = req.body.address.toLowerCase();

      let after = 0;
      if (req.body.after) {
        after = parseInt(req.body.after);
        if (after < 0) {
          after = 0;
        }
      }

      abiDecoder.addABI(contract.abi);

      let decimals = 0;
      try {
        decimals = token.decimals ? token.decimals() : 0;
      } catch (e) {
        decimals = 0;
      }
      const divisor = new BigNumber(10).pow(decimals);

      let fromBlock = transaction.blockNumber;
      fromBlock = web3.toHex(fromBlock);
      const filter = { 'fromBlock': fromBlock, 'toAddress': [addr], 'count': MAX_ENTRIES };

      if (after) {
        filter.after = after;
      }

      web3.trace.filter(filter, (err, tx) => {
        if (err || !tx) {
          console.error(`TraceWeb3 error :${err}`);
          res.write(JSON.stringify({ 'error': true }));
        } else {
          let txns = filterTrace(tx);
          txns = txns.map((t) => {
            if (t.type === 'call') {
              const callInfo = abiDecoder.decodeMethod(t.action.input);
              if (callInfo && callInfo.name && callInfo.name === 'transfer') {
              // convert amount
                const amount = new BigNumber(callInfo.params[1].value);
                t.amount = amount.dividedBy(divisor).toString(10);
                // replace to address with _to address arg
                t.to = callInfo.params[0].value;
                t.type = 'transfer';
              }
              t.callInfo = callInfo;
            }
            return t;
          });
          res.write(JSON.stringify({ transaction: txns, after, count: filter.count }));
        }
        res.end();
      });

    }
  });

};
