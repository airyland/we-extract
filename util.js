const qs = require('qs')

function getParameterByName(name, url = window.location.href) {
  name = name.replace(/[\[\]]/g, '\\$&');
  var regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
    results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

function normalizeUrl (url = '') {
  const parts = url.replace(/&amp;/g, '&').split('?')
  const rs = qs.parse(parts[1])
  const querys = qs.stringify(rs)
  if (querys) {
    return parts[0] + '?' + querys
  } else {
    return parts[0]
  }
}

module.exports = {
  getParameterByName,
  normalizeUrl
}