const dayjs = require('dayjs')

module.exports = function({
	post,
	basic,
	script,
	getError,
	html,
	$,
	shouldReturnRawMeta
}) {
	const lines = script.split('\n')
	const lines2 = lines.filter(line => !!line.trim())
	let code = lines2.filter((line, index) => {
		return /d\./.test(line) || (lines2[index - 1] && lines2[index - 1].includes('d.') && !line.includes('}'))
	})
	code = `var d = {};
            \nfunction getXmlValue (path) {
              return false
            }\n` + code.join('\n').replace('var d = _g.cgiData;', 'var d = {}') + '\n  return d;'
	let data = {}
	code = `var _g = {};` + code
	const fn = new Function(code)
	data = fn()
	basic.accountName = data.nick_name
	basic.accountAvatar = data.hd_head_img
	basic.accountId = data.user_name

	// biz
	if (!basic.accountBiz && data.biz) {
		basic.accountBiz = data.biz
		basic.accountBizNumber = Buffer.from(basic.accountBiz, 'base64').toString() * 1
	}

	// 标题
	post.msg_title = data.title
	post.msg_desc = null
	post.msg_cover = null
	post.msg_link = data.msg_link || null
	post.msg_article_type = null

	// sn, idx, mid
	post.msg_sn = data.sn || null
	post.msg_idx = data.idx ? data.idx * 1 : null
	post.msg_mid = data.mid ? data.mid * 1 : null

	// 视频链接赋值于 source_url
	const vidMatch = html.match(/vid\s*:\s*'(.*?)'/)
	if (vidMatch && vidMatch[1]) {
		data.vid = vidMatch[1]
		// 旧版 vid 已经不适用
		// post.msg_source_url = 'http://v.qq.com/x/page/' + vid + '.html'
	}
	if (!post.msg_cover) {
		// 旧版废弃
		// post.msg_cover = `https://vpic.video.qq.com/60643382/${vid}.png`
		post.msg_cover = $("meta[property='og:image']").attr("content")
	}

	// 视频只有标题 + 内容，内容直接从 meta 里取
	const description = $("meta[name='description']").attr("content")
	post.msg_content = description

	// 发布时间
	if (data.create_time) {
		post.msg_publish_time = new Date(data.create_time * 1000)
		post.msg_publish_time_str = dayjs(post.msg_publish_time).format('YYYY/MM/DD HH:mm:ss')
	}

	// 如果没有，使用 ct_str
	if (!data.create_time && data.ct_str) {
		post.msg_publish_time = new Date(data.ct_str)
		post.msg_publish_time_str = dayjs(post.msg_publish_time).format('YYYY/MM/DD HH:mm:ss')
	}

	if (shouldReturnRawMeta) {
		post.raw_data = data
	}

}