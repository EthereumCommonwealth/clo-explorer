const http = require('http');

const etherUnits = require(`${__lib}etherUnits.js`);

module.exports = function (req, res) {
  let { addr } = req.body;
  if (typeof addr !== 'undefined') addr = addr.toLowerCase();
  else { res.sendStatus(400); }

  const options = {
    host: 'api.blockcypher.com',
    port: '80',
    path: `/v1/eth/main/addrs/${addr}/balance`,
    method: 'GET',
  };

  let balance = 0;
  http.request(options, (bcRes) => {
    bcRes.on('data', (data) => {
      try {
        balance = JSON.parse(data).balance;
        balance = etherUnits.toEther(balance, 'wei');
      } catch (e) {
        console.error('BC err, probably invalid addr');
      }
      res.write(JSON.stringify({ 'balance': balance }));
      res.end();
    });
  }).end();

};

