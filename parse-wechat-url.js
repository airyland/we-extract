const querystring = require('querystring')

function parse (url) {
  if (!url) {
    return {}
  }

  const rs = querystring.parse(url.replace(/&amp;/g, '&').split('?')[1])
  return {
    mid: rs.mid * 1,
    idx: rs.idx * 1,
    sn: rs.sn,
    biz: rs.__biz
  }
}

module.exports = parse
