const path = require('path');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const fs = require('fs');
const jsonFile = require('jsonfile');

const express = require('express');
const router = express.Router();

jsonFile.readFile(__dirname + '/data/allCookies.json')
  .then((res) => {
    global.allCookies = res;
  }, (err) => {
    global.allCookies = {};
  });

jsonFile.readFile(__dirname + '/data/cookie.json')
  .then((res) => {
    global.userCookie = res;
  }, (err) => {
    global.userCookie = {}
  });

// 每5分钟存一下数据
setInterval(() => dataHandle.saveInfo(), 60000 * 5);

fs.readdirSync(path.join(__dirname, 'routes')).reverse().forEach(file => {
  const filename = file.replace(/\.js$/, '');
  router.use(`/${filename}`, (req, res, next) => {
    global.response = res;
    global.req = req;
    req.query = {
      ...req.query,
      ...req.body,
    };
    req.cookies.uin = (req.cookies.uin || '').replace(/\D/g, '');
    const callback = require(`./routes/${filename}`);
    callback(req, res, next);
  });
});

router.use('/', require('./routes/index'));

module.exports = router;
