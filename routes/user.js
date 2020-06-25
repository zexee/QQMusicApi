const express = require('express');
const router = express.Router();
const request  = require('../util/request');
const jsonFile = require('jsonfile');
const axios = require('axios');

router.get('/cookie', (req, res) => {
  res.send({
    result: 100,
    data: {
      cookie: req.cookies,
      userCookie: global.userCookie,
    }
  });
});

router.get('/getCookie', (req, res) => {
  console.log(global.userCookie)
  return res.json(global.userCookie)
});

function SetLoginCookie(o) {
  const userCookie = {
    wxuin: 'o' + global.QQ,
    qm_keyst: o.music_key,
    qqmusic_key: o.music_key,
    wxopenid: o.wxopenid,
    wxrefresh_token: o.wxrefresh_token,
    wxunionid: o.wxunionid,
  };
  global.userCookie = userCookie
  jsonFile.writeFile(__dirname + '/../data/cookie.json', global.userCookie)
  console.log(global.userCookie)
}

function FinishLogin(wxcode) {
  const instance = axios.create({
      baseURL: 'https://c.y.qq.com/base/fcgi-bin/',
      timeout: 10000,
      headers: {'Referer': 'https://y.qq.com/portal/wx_redirect.html?login_type=2&surl=https://y.qq.com/portal/profile.html'}
  });

  var url = 'https://c.y.qq.com/base/fcgi-bin/h5_login_wx_get_musickey.fcg?wxcode=' + wxcode + '&appid=wx48db31d50e334801&jsonpCallback=SetLoginCookie'
  console.log(url)
  instance.get(url)
    .then((rr) => {
      console.log(rr.data)
      eval(rr.data)
    })
}

function LoginPull(retry, uuid, last) {
  if (retry > 10) return;
  const instance = axios.create({
      baseURL: 'https://lp.open.weixin.qq.com/connect/l/',
      timeout: 30000,
      headers: {'Referer': 'https://open.weixin.qq.com/connect/qrconnect?appid=wx48db31d50e334801'}
  });

  var url = 'https://lp.open.weixin.qq.com/connect/l/qrconnect?uuid=' + uuid + '&_=' + (new Date() * 1)
  if (last) url += '&last=' + last
  console.log(url)
  instance.get(url)
    .then((rr) => {
      console.log(rr.data)
      if (rr.data.length == 0) {
        return LongPull(retry + 1, uuid)
      }
      var window = {}
      eval(rr.data)
      if (window.wx_errcode == 404) {
        return LoginPull(0, uuid, 404)
      }
      if (window.wx_errcode == 405 && window.wx_code.length > 0) {
        console.log(window.wx_code)
        FinishLogin(window.wx_code)
      }
    })
}

router.get('/', (req, res) => {
  global.UserCookie = {}
  axios.get('https://open.weixin.qq.com/connect/qrconnect?appid=wx48db31d50e334801&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fwx_redirect.html%3Flogin_type%3D2%26surl%3Dhttps%3A%2F%2Fy.qq.com%2Fportal%2Fprofile.html%23stat%3Dy_new.top.user_pic%26stat%3Dy_new.top.pop.logout&response_type=code&scope=snsapi_login&state=STATE')
    .then((rr) => {
      var r = rr.data
      var startpos = r.indexOf('/connect/qrcode/')
      var endpos = r.indexOf('"', startpos)
      var url = r.substr(startpos, endpos - startpos)
      var uuid = url.substr(url.lastIndexOf('/') + 1)
      LoginPull(0, uuid)
      return res.end('https://open.weixin.qq.com' + url)
      // return res.end('<html><body><img src="https://open.weixin.qq.com' + url + '"></img></body></html>')
    })
})

router.post('/setCookie', (req, res) => {
  const { data } = req.body;
  const userCookie = {};
  data.split('; ').forEach((c) => {
    const arr = c.split('=');
    userCookie[arr[0]] = arr[1];
  });

  global.allCookies[userCookie.uin] = userCookie;
  jsonFile.writeFile(__dirname + '/../data/allCookies.json', global.allCookies);

  // 这里写死我的企鹅号，作为存在服务器上的cookie
  if (String(userCookie.uin) === String(global.QQ) ||
      userCookie.wxuin == 'o' + global.QQ) {
    global.userCookie = userCookie;
    jsonFile.writeFile(__dirname + '/../data/cookie.json', global.userCookie);
  }


  res.send({
    result: 100,
    data: '操作成功',
  })
});

// 获取用户歌单
router.get('/detail', async (req, res) => {
  var { id } = req.query;

  if (!id) {
    id = global.QQ
  }
  const result = await request({
    url: 'http://c.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg',
    data: {
      cid: 205360838, // 管他什么写死就好了
      userid: id, // qq号
      reqfrom: 1,
    }
  });

  if (result.code === 1000) {
    return res.send({
      result: 301,
      errMsg: '未登陆',
      info: '建议在 https://y.qq.com 登陆并复制 cookie 尝试'
    })
  }

  result.result = 100;
  res.send(result);
});

// 获取用户创建的歌单
router.get('/songlist', async (req, res) => {
  var { id, raw } = req.query;
  if (!id) {
    id = global.QQ
  }
  const result = await request({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_user_created_diss',
    data: {
      hostUin: 0,
      hostuin: id,
      sin: 0,
      size: 200,
      g_tk: 5381,
      loginUin: 0,
      format: 'json',
      inCharset: 'utf8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 0,
    },
    headers: {
      Referer: 'https://y.qq.com/portal/profile.html',
    },
  });

  if (Number(raw)) {
   return res.send(result);
  }

  if (result.code === 4000) {
    return res.send({
      result: 100,
      data: {
        list: [],
        message: '这个人不公开歌单',
      },
    })
  }
  if (!result.data) {
    return res.send({
      result: 200,
      errMsg: '获取歌单出错',
    })
  }
  result.data.disslist.find((v) => v.dirid === 201).diss_cover = 'http://y.gtimg.cn/mediastyle/global/img/cover_like.png';
  return res.send({
    result: 100,
    data: {
      list: result.data.disslist,
      creator: {
        hostuin: result.data.hostuin,
        encrypt_uin: result.data.encrypt_uin,
        hostname: result.data.hostname,
      }
    }
  })
});

// 获取用户收藏的歌单
router.get('/collect/songlist', async (req, res) => {
  var { id, pageNo = 1, pageSize = 200, raw } = req.query;
  if (!id) {
    id = global.QQ
  }
  const result = await request({
    url: 'https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg',
    data: {
      ct: 20,
      cid: 205360956,
      userid: id,
      reqtype: 3,
      sin: (pageNo - 1) * pageSize,
      ein: pageNo * pageSize,
    }
  });
  if (Number(raw)) {
    return res.send(result);
  }
  const { totaldiss, cdlist } = result.data;
  return res.send({
    result: 100,
    data: {
      list: cdlist,
      total: totaldiss,
      pageNo,
      pageSize,
    }
  })
});

// 获取用户收藏的专辑
router.get('/collect/album', async (req, res) => {
  var { id, pageNo = 1, pageSize = 200, raw } = req.query;
  if (!id) {
    id = global.QQ
  }
  const result = await request({
    url: 'https://c.y.qq.com/fav/fcgi-bin/fcg_get_profile_order_asset.fcg',
    data: {
      ct: 20,
      cid: 205360956,
      userid: id,
      reqtype: 2,
      sin: (pageNo - 1) * pageSize,
      ein: pageNo * pageSize - 1,
    }
  });
  if (Number(raw)) {
    return res.send(result);
  }
  const { totalalbum, albumlist } = result.data;
  return res.send({
    result: 100,
    data: {
      list: albumlist,
      total: totalalbum,
      pageNo,
      pageSize,
    }
  })
});

// 获取关注的歌手
router.get('/follow/singers', async (req, res) => {
  var { id, pageNo = 1, pageSize = 200, raw } = req.query;
  if (!id) {
    id = global.QQ
  }

  const result = await request({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_getlist.fcg',
    data: {
      utf8: 1,
      page: pageNo,
      perpage: pageSize,
      uin: id,
      g_tk: 5381,
      format: 'json',
    }
  });

  if (result.code === 1000) {
    return res.send({
      result: 301,
      errMsg: '未登陆',
      info: '建议在 https://y.qq.com 登陆并复制 cookie 尝试'
    })
  }

  if (raw) {
    return res.send(result);
  }

  res.send({
    total: result.num,
    pageNo: Number(pageNo),
    pageSize: Number(pageSize),
    data: result.list,
  })
});

// 关注歌手操作
router.get('/follow', async (req, res) => {
  const { singermid, raw, operation = 1, type = 1 } = req.query;

  const urlMap = {
    12: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_del.fcg',
    11: 'https://c.y.qq.com/rsc/fcgi-bin/fcg_order_singer_add.fcg',
  };

  if (!singermid) {
    return res.send({
      result: 500,
      errMsg: 'singermid 不能为空',
    });
  }

  const url = urlMap[(type * 10) + (operation * 1)];
  const result = await request({
    url,
    data: {
      g_tk: 5381,
      format: 'json',
      singermid,
    }
  });

  if (Number(raw)) {
    return res.send(result);
  }

  switch (result.code) {
    case 1000:
      return res.send({
        result: 301,
        errMsg: '未登陆',
        info: '建议在 https://y.qq.com 登陆并复制 cookie 尝试'
      });
    case 0:
      return res.send({
        result: 100,
        data: '操作成功',
        message: 'success',
      });
    default:
      return res.send({
        result: 200,
        errMsg: '未知异常',
        info: result,
      })
  }
});

// 获取关注的用户
router.get('/follow/users', async (req, res) => {
  var { id, pageNo = 1, pageSize = 20, raw } = req.query;
  if (!id) {
    id = global.QQ
  }

  const result = await request({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/friend_follow_or_listen_list.fcg',
    data: {
      utf8: 1,
      start: (pageNo - 1) * pageSize,
      num: pageSize,
      uin: id,
      format: 'json',
      g_tk: 5381,
    }
  });

  if (result.code === 1000) {
    return res.send({
      result: 301,
      errMsg: '未登陆',
      info: '建议在 https://y.qq.com 登陆并复制 cookie 尝试'
    })
  }

  if (Number(raw)) {
    return res.send(result);
  }

  res.send({
    result: 100,
    pageNo: pageNo / 1,
    pageSize: pageSize / 1,
    data: result.list,
  })
});

// 获取用户粉丝
router.get('/fans', async (req, res) => {
  var { id, pageNo = 1, pageSize = 200, raw } = req.query;
  if (!id) {
    id = global.QQ
  }

  const result = await request({
    url: 'https://c.y.qq.com/rsc/fcgi-bin/friend_follow_or_listen_list.fcg',
    data: {
      utf8: 1,
      start: (pageNo - 1) * pageSize,
      num: pageSize,
      uin: id,
      format: 'json',
      g_tk: 5381,
      is_listen: 1,
    }
  });

  if (result.code === 1000) {
    return res.send({
      result: 301,
      errMsg: '未登陆',
      info: '建议在 https://y.qq.com 登陆并复制 cookie 尝试'
    })
  }

  if (Number(raw)) {
    return res.send(result);
  }

  res.send({
    result: 100,
    pageNo: pageNo / 1,
    pageSize: pageSize / 1,
    data: result.list,
  })
});

module.exports = router;
