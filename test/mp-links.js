const extract = require('..').extract
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const url = 'https://mp.weixin.qq.com/s?__biz=MzIwNjU2ODk1MQ==&mid=2247497639&idx=1&sn=bba35c164cbae04da8d78808151d35aa&chksm=971d1b3fa06a922971367bca63cce1f8a754b582c4ce7c2d07dfb28e5dd2b38d7695ff72b56b&scene=132#wechat_redirect'

const content = fs.readFileSync(path.join(__dirname, './mp-link.html'), 'utf-8')
;(async () => {
	const res = await extract(content, {
		shouldReturnContent: false,
		shouldExtractMpLinks: true
	})
	console.log(JSON.stringify(res, null, 2))
})()
