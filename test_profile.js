const fs = require('fs')
const extract = require('./extract-profile')

const html = fs.readFileSync('./links/profile.html', 'utf-8')

const rs = extract(html)
console.log(JSON.stringify(rs, null, 2))
