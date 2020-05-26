/**
 * @author Alexis Roussel <alexis@bity.com>
 * @author Peter Pratscher <peter@bitfly.at>
 * @date 2017
 * @license LGPL
 * @changelog 2018/05/19 - modified for web3.js 0.20.x using extend() method. (by hackyminer <hackyminer@gmail.com>)
 */
module.exports = function(web3) {
  /**
   * @file trace.js
   * @author Alexis Roussel <alexis@bity.com>
   * @date 2017
   * @license LGPL
   */
  web3.extend({
    property: 'trace',
    methods: [
      new web3.extend.Method({
        name: 'call',
        call: 'trace_call',
        params: 3,
        inputFormatter: [web3.extend.formatters.inputCallFormatter, null, web3.extend.formatters.inputDefaultBlockNumberFormatter]
      }),

      new web3.extend.Method({
        name: 'rawTransaction',
        call: 'trace_rawTransaction',
        params: 2
      }),

      new web3.extend.Method({
        name: 'replayTransaction',
        call: 'trace_replayTransaction',
        params: 2
      }),

      new web3.extend.Method({
        name: 'block',
        call: 'trace_block',
        params: 1,
        inputFormatter: [web3.extend.formatters.inputDefaultBlockNumberFormatter]
      }),

      new web3.extend.Method({
        name: 'filter',
        call: 'trace_filter',
        params: 1
      }),

      new web3.extend.Method({
        name: 'get',
        call: 'trace_get',
        params: 2
      }),

      new web3.extend.Method({
        name: 'transaction',
        call: 'debug_traceTransaction',
        params: 1
      })
    ]
  });

  /**
   * @file parity.js
   * @author Peter Pratscher <peter@bitfly.at>
   * @date 2017
   * @license LGPL
   */
  web3.extend({
    property: 'parity',
    methods: [
      new web3.extend.Method({
        name: 'pendingTransactions',
        call: 'parity_pendingTransactions',
        params: 0,
        outputFormatter: web3.extend.formatters.outputTransactionFormatter
      }),

      new web3.extend.Method({
        name: 'pendingTransactionsStats',
        call: 'parity_pendingTransactionsStats',
        params: 0
      }),

      new web3.extend.Method({
        name: 'listAccounts',
        call: 'parity_listAccounts',
        params: 3,
        inputFormatter: [null, null, web3.extend.formatters.inputDefaultBlockNumberFormatter]
      }),

      new web3.extend.Method({
        name: 'phraseToAddress',
        call: 'parity_phraseToAddress',
        params: 1
      })
    ]
  });
  return web3;
};
