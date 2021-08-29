const qs = require('qs')
const dayjs = require('dayjs')
const request = require('request-promise')
const cheerio = require('cheerio')
const parseUrl = require('./parse-wechat-url')
const errors = require('./errors')
const unescape = require('lodash.unescape')
const {
  getParameterByName,
  normalizeUrl
} = require('./util')

const video = require('./video')

const defaultConfig = {
  shouldReturnRawMeta: false,
  shouldReturnContent: true,
  shouldFollowTransferLink: true,
  shouldExtractMpLinks: false,
  shouldExtractTags: false,
  shouldExtractRepostMeta: false
}

const basic = {}
basic.accountId = ''
basic.accountAvatar = ''

basic.accountBiz = null
basic.accountBizNumber = null
basic.accountName = null

const getError = function(code) {
  return {
    done: false,
    code: code,
    msg: errors[code]
  }
}

const extract = async function(html, options = {}) {
  const {
    shouldReturnRawMeta,
    shouldReturnContent,
    shouldFollowTransferLink,
    shouldExtractMpLinks,
    shouldExtractTags,
    shouldExtractRepostMeta
  } = Object.assign({}, defaultConfig, options)

  let paramType = 'HTML' // 参数为 URL 还是 HTML
  let url = null
  let rawUrl = null

  if (options.url) {
    url = normalizeUrl(options.url)
  }

  let type = 'post'
  let hasCopyright = false
  let shareContentTpl

  if (!html) {
    return getError(2001)
  }

  // 参数错误

  // 支持地址
  if (/^http/.test(html)) {
    html = normalizeUrl(html)
    if (!/http(s?):\/\/mp.weixin.qq.com/.test(html) && !/http(s?):\/\/weixin.sogou.com/.test(html)) {
      return getError(2009)
    }
    paramType = 'URL'
    rawUrl = html
    if (!url) {
      url = html
    }
    let host = 'mp.weixin.qq.com'
    if (/http(s?):\/\/weixin.sogou.com/.test(html)) {
      host = 'weixin.sogou.com'
    }
    try {
      html = await request({
        uri: html,
        method: 'GET',
        headers: {
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.181 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Host': host
        }
      })

      if (html.includes('location.replace')) {
        const rs = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)
        if (rs && rs[0]) {
          const code = rs[0].split('\n').filter(one => {
            return !one.includes('location.replace') && !one.includes('script>')
          }).join('\n') + '\n return url;'

          try {
            const fn = new Function(code)
            return await extract(fn(), options)
          } catch (e) {
            return getError(1005)
          }
        }
      }
    } catch (e) {
      return getError(1002)
    }
  } else {
    html = html.replace(/\\n/g, '')
  }

  if (!html) {
    return getError(1003)
  }

  if (html.includes('访问过于频繁') && !html.includes('js_content')) {
    return paramType === 'URL' ? getError(1004) : getError(2010)
  } else if (html.includes('链接已过期') && !html.includes('js_content')) {
    return getError(2002)
  } else if (html.includes('被投诉且经审核涉嫌侵权，无法查看')) {
    return getError(2003)
  } else if (html.includes('该公众号已迁移')) {
    const match = html.match(/var\stransferTargetLink\s=\s'(.*?)';/)
    if (match && match[1]) {
      if (shouldFollowTransferLink) {
        return await extract(match[1])
      } else {
        return {
          ...getError(1006),
          url: match[1]
        }
      }
    } else {
      return getError(2004)
    }
  } else if (html.includes('该内容已被发布者删除')) {
    return getError(2005)
  } else if (html.includes('此内容因违规无法查看')) {
    return getError(2006)
  } else if (html.includes('此内容发送失败无法查看')) {
    return getError(2007)
  } else if (html.includes('由用户投诉并经平台审核，涉嫌过度营销、骚扰用户')) {
    return getError(2011)
  } else if (html.includes('此帐号已被屏蔽') && !html.includes('id="js_content"')) {
    return getError(2012)
  } else if (html.includes('此帐号已自主注销') && !html.includes('id="js_content"')) {
    return getError(2013)
  } else if (!html.includes('id="js_content"') && html.includes('此帐号处于帐号迁移流程中')) {
    return getError(2015)
  } else if (html.includes('page_rumor') && !html.includes('id="js_content"')) {
    return getError(2014)
  } else if (!html.includes('id="js_content"') && html.includes('参数错误') && html.includes('appmsg/error.html')) {
    return getError(2009)
  } else if (!html.includes('id="js_content"') && !html.includes('id=\\"js_content\\"')) {
    return getError(1000)
  }

  html = html.replace('>微信号', ' id="append-account-alias">微信号')
    .replace('>功能介绍', ' id="append-account-desc">功能介绍')
    .replace(/\n\s+<script/g, '\n\n<script')

  const $ = cheerio.load(html, {
    decodeEntities: false
  })

  // 原创
  if ($('#copyright_logo') && $('#copyright_logo').text().includes('原创')) {
    hasCopyright = true
  }

  // 检查是否为视频类型
  const hasVideo = /video/.test($('body').attr('class'))
  if (hasVideo) {
    type = 'video'
  }

  const hasImage = $('#js_content > #img_list')
  if (hasImage.length) {
    type = 'image'
  }

  const hasShare = $('#js_share_content')
  if (hasShare.length) {
    type = 'repost'
  }

  // https://mp.weixin.qq.com/s?__biz=MzIxNDEzNzI4Mg==&mid=2653326714&idx=5&sn=838a05d4d37b9b9cd286dab03b6b610a&chksm=8c7e0dd7bb0984c1eaba456084ca3accab603b102afe847087dbcdbb2842e91cb2de1142bb1a&scene=27#wechat_redirect
  if ($('.page_share_audio').length || $('#voice_parent').length) {
    type = 'voice'
  }

  if (/share_media_text/.test(html)) {
    type = 'text'
  }

  // @todo 检查是否为图片类型

  // @todo 链接已过期
  const expire = $('.weui-msg .weui-msg__title').text()

  if (expire.trim() === '链接已过期') {
    return getError(2002)
  }

  const error = $('.global_error_msg.warn').text()

  if (error.trim().includes('系统出错')) {
    return getError(2008)
  }

  basic.accountName = $('.profile_nickname').text()

  // alias
  const accountAliasPrev = $('#append-account-alias')
  let accountAlias = accountAliasPrev.siblings('span').text()

  const accountDescPrev = $('#append-account-desc')
  let accountDesc = accountDescPrev.siblings('span').text()

  const post = {
    msg_has_copyright: hasCopyright
  }
  post.msg_content = null
  if (shouldReturnContent) {
    post.msg_content = $('#js_content').html()
  }

  // 获取 block
  const rs = html.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/gi)

  // 作者信息
  let msgAuthor = null
  const $author = $('.rich_media_meta_text')
  if ($author.length) {
    let info = $author.text().trim()
    //20180622 布局变动
    if (info.includes('原创：')) {
      info = info.replace('原创：', '').trim()
    }
    post.msg_author = info.trim()
  }

  let extractExtra = false
  const extra = {
    biz: null,
    sn: null,
    mid: null,
    idx: null,
    msg_title: null,
    user_name: null,
    nick_name: null,
    hd_head_img: null
  }
  const extraFields = Object.keys(extra)

  for (let i = 0; i < rs.length; i++) {
    const script = rs[i]

    if (type === 'voice' && script.includes('voiceid')) {
      const lines = script.split(/\n|\r/).filter(one => one.includes('voiceid')).sort((a, b) => a.length > b.length ? -1 : 1)
      if (lines.length) {
        const val = lines[0].replace(/'|"|:|voiceid|,/g, '')
        if (val) {
          post.msg_source_url = `https://res.wx.qq.com/voice/getvoice?mediaid=${val.trim()}`
        }
      }
    }

    if (!extractExtra) {
      // biz
      extraFields.forEach(field => {
        const reg = new RegExp(`var\\s+${field}\\s*=`)
        if (reg.test(script)) {
          try {
            const line = script.split('\n').filter(one => reg.test(one))
            const fn = new Function(`${line} \n return ${field}`)
            extra[field] = fn()
          } catch (e) {
            console.log('error', e)
          }
          if (!extractExtra) {
            extractExtra = true
          }
        }

        if (!extra[field]) {
          const reg2 = new RegExp(`window\.${field}\\s*=`)
          if (reg2.test(script)) {
            try {
              const line = script.split('\n').filter(one => reg2.test(one))
              const code = `window = {}; ${line} \n return window.${field}`
              const fn = new Function(code)
              extra[field] = fn()
            } catch (e) {
              console.log(e)
            }
            if (!extractExtra) {
              extractExtra = true
            }
          }
        }
      })

      if (extractExtra) {
        basic.accountBiz = extra.biz
        if (basic.accountBiz) {
          basic.accountBizNumber = Buffer.from(basic.accountBiz, 'base64').toString() * 1
        }

        post.msg_sn = extra.sn || null
        post.msg_idx = extra.idx ? extra.idx * 1 : null
        post.msg_mid = extra.mid ? extra.mid * 1 : null
      }
    }

    extraFields.forEach(field => {
      if (!extra[field]) {
        const reg3 = new RegExp(`d\.${field}\\s*=`)
        if (reg3.test(script)) {
          let code
          try {
            let line = script.split('\n').filter(one => reg3.test(one))
            if (line.length) {
              line = line[0]
              code = `d = {}; xml = false;
              \nfunction getXmlValue (path) {
                return false
              }
              \n${line} \n return d.${field}`
              code = code.replace(/;,/g, ';')
              const fn = new Function(code)
              extra[field] = fn()
            }
          } catch (e) {
          }
          if (!extractExtra) {
            extractExtra = true
          }
        }
      }
    })

    // 视频
    if (['video', 'text'].includes(type) && script.includes('d.title')) {
      try {
        video({
          post,
          basic,
          script,
          getError,
          html,
          $,
          shouldReturnRawMeta
        })
      } catch (e) {
        return getError(1005)
      }
    }

    if ((type === 'image' || type === 'voice') && script.includes('d.title =')) {
      const lines = script.split('\n').filter(line => !!line.trim())
      let code = lines.filter((line, index) => /d\./.test(line) || (lines[index - 1] && lines[index - 1].includes('d.') && !line.includes('}')))
      code = `var d = {};
            \nfunction getXmlValue (path) {
              return false
            }\n` + code.join('\n').replace('var d = _g.cgiData;', 'var d = {}') + '\n  return d;'
      let data = {}
      code = `var _g = {};` + code
      try {
        code = `var _g = {};` + code
        const fn = new Function(code)
        data = fn()
        accountName = data.nick_name
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
        if (type === 'video') {
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
        }

        // 视频只有标题 + 内容，内容直接从 meta 里取
        if (type === 'video' || type === 'voice') {
          const description = $("meta[name='description']").attr("content")
          post.msg_content = description
        }

        // 发布时间
        if (data.create_time) {
          post.msg_publish_time = new Date(data.create_time * 1000)
          post.msg_publish_time_str = dayjs(post.msg_publish_time).format('YYYY/MM/DD HH:mm:ss')
        }

        if (shouldReturnRawMeta) {
          post.raw_data = data
        }
      } catch (e) {
        return getError(1005)
      }
    }
    // 图文
    if ((type === 'post' || type === 'repost') && script.includes('var msg_link = ')) {
      const lines = script.split('\n')
      let code = lines.slice(1, lines.length - 1).filter(line => {
        return !line.includes('var title')
      }).map(line => {
        // 特殊符号可能会导致解析出 bug
        if (/var\s+msg_desc/.test(line)) {
          line = line.replace(/`/g, "'")
          line = line.replace(/"/g, '`')
        }
        return line
      }).join('\n')

      code = `var window = {
        location: {
          protocol: 'https'
        }
      };\nvar document={
        addEventListener: function () {}
      };\nvar location={protocol: "https"};\n` + code

      let rs = ';var rs = {'
      code.match(/var\s(.*?)\s=/g).map(key => key.split(' ')[1]).forEach(key => {
        if (key !== 'window') {
          rs += `"${key}": typeof ${key} !== 'undefined' ? ${key} : null,`
        }
      })

      rs += '\n}\n return rs \n'

      code += rs
      let data = {}
      try {
        code = ` String.prototype.html = function(encode) {
        var replace =["&#39;", "'", "&quot;", '"', "&nbsp;", " ", "&gt;", ">", "&lt;", "<", "&yen;", "¥", "&amp;", "&"];
        var replaceReverse = ["&", "&amp;", "¥", "&yen;", "<", "&lt;", ">", "&gt;", " ", "&nbsp;", '"', "&quot;", "'", "&#39;"];
	    var target;
	    if (encode) {
	    	target = replaceReverse;
	    } else {
	    	target = replace;
	    }
        for (var i=0,str=this;i< target.length;i+= 2) {
             str=str.replace(new RegExp(target[i],'g'),target[i+1]);
        }
        return str;
    };
	` + code
        const fn = new Function(code)
        data = fn()
      } catch (e) {
        return getError(1005)
      }

      const fields = ['msg_title', 'msg_desc', 'msg_link', 'msg_source_url']

      fields.forEach(key => {
        post[key] = data[key] || null
      })

      post.msg_cover = data.msg_cdn_url

      post.msg_article_type = data['_ori_article_type'] || null
      post.msg_publish_time = new Date(data.ct * 1000)
      post.msg_publish_time_str = dayjs(post.msg_publish_time).format('YYYY/MM/DD HH:mm:ss')
      if (shouldReturnRawMeta) {
        post.raw_data = data
      }
      basic.accountId = data.user_name
      basic.accountAvatar = data.ori_head_img_url

      if (!basic.accountName && data.nickname) {
        basic.accountName = data.nickname
      }
    }
  }

  // 有可能没有时间
  if (!post.msg_publish_time) {
    let date = $('#post-date').text()
    if (date) {
      post.msg_publish_time = new Date(date)
    }
  }

  if (!post.msg_publish_time) {
    let date = $('#publish_time').text()
    if (date) {
      post.msg_publish_time = new Date(date)
    }
  }

  // 有可能标题不存在
  if (!post.msg_title) {
    let title = $('.rich_media_title').text()
    if (title) {
      post.msg_title = title.trim()
    }
  }

  // 转发类型可能 name 没有
  if (!post.account_name) {
    let name = $('.account_nickname_inner').text()
    if (name) {
      post.account_name = name.trim()
    }
  }

  post.msg_type = type

  // 有可能 ori_head_img_url 不存在，避免被设置成 /132
  if (post.ori_head_img_url && post.ori_head_img_url.length < 10) {
    post.ori_head_img_url = null
  }

  // 新注册公众号没有头像，置为 null
  if (basic.accountAvatar.length < 10) {
    basic.accountAvatar = null
  }

  // 有可能缺失 mid idx 等信息，从 url 中进行解析
  if (post.msg_link && post.msg_link.includes('biz')) {
    const parseParams = parseUrl(post.msg_link)
    const list = ['mid', 'sn', 'idx']
    list.forEach(field => {
      if (!post[`msg_${field}`] && parseParams[field]) {
        post[`msg_${field}`] = parseParams[field]
      }
    })
  }

  // 转载类型，内容不在 js_content 里
  if (type === 'repost') {
    let html = $('#content_tpl').html()
    html = html.replace(/<img[^>]*>/g, '<p>[图片]</p>');
    html = html.replace(/<iframe [^>]*?class=\"res_iframe card_iframe js_editor_card\"[^>]*?data-cardid=\"\"[^>]*?><\/iframe>/ig, '<p>[卡券]</p>');
    html = html.replace(/<mpvoice([^>]*?)js_editor_audio([^>]*?)><\/mpvoice>/g, '<p>[语音]</p>');
    html = html.replace(/<mpgongyi([^>]*?)js_editor_gy([^>]*?)><\/mpgongyi>/g, '<p>[公益]</p>');
    html = html.replace(/<qqmusic([^>]*?)js_editor_qqmusic([^>]*?)><\/qqmusic>/g, '<p>[音乐]</p>');
    html = html.replace(/<mpshop([^>]*?)js_editor_shop([^>]*?)><\/mpshop>/g, '<p>[小店]</p>');
    html = html.replace(/<iframe([^>]*?)class=[\'\"][^\'\"]*video_iframe([^>]*?)><\/iframe>/g, '<p>[视频]</p>');
    html = html.replace(/(<iframe[^>]*?js_editor_vote_card[^<]*?<\/iframe>)/gi, '<p>[投票]</p>');
    html = html.replace(/<mp-weapp([^>]*?)weapp_element([^>]*?)><\/mp-weapp>/g, '<p>[小程序]</p>');
    html = html.replace(/<mp-miniprogram([^>]*?)><\/mp-miniprogram>/g, '<p>[小程序]</p>');
    html = html.replace(/<br\s*\/>/g, 'WEEXTRACT')

    const $$ = cheerio.load(html, {
      decodeEntities: false
    })
    let processedContent = $$.text()
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim().substr(0, 140)
    const digest = processedContent.split('WEEXTRACT').map(function(line) {
      return '<p>' + line + '</p>';
    }).join('')

    $('#js_content').append(digest)
    const notice = $.html('.share_notice')
    const content = $.html('#js_share_content')
    post.msg_content = `<div>${notice}${content}</div>`
  }

  // 使用图片作为 cover
  if (type === 'image' && !post.msg_cover) {
    const image = $('#img_list > img').eq(0).attr('src')
    if (image) {
      post.msg_cover = image
    }
  }

  if (/document\.write/.test(post.msg_content)) {
    const reg = /<script[\s\S]*?>([\s\S]*?)<\/script>/

    const rs = post.msg_content.match(reg)

    if (rs) { // 有可能只是正文里提到了 document.write
      const script = rs[0]

      if ((type === 'voice' || type === 'image') && /document\.write/.test(script)) {
        try {
          const code = script
            .split('.replace')[0]
            .split('\n')
            .filter(one => !one.includes('<script') && !one.includes('script>'))
            .join('\n')
            .replace('document.write', 'return ') + ')'

          const fn = new Function(code)
          post.msg_content = post.msg_content.replace(reg, fn())
        } catch (e) {
          // 此处在 v1.2.0 之后不报错，因为不影响整体流程
          // return getError(1005)
        }
      }
    }
  }

  // 避免有换行符
  if (post.msg_content) {
    post.msg_content = post.msg_content.trim().replace(/\n/g, "<br>")
  }

  if (!basic.accountId && extra.user_name) {
    basic.accountId = extra.user_name
  }

  if (!basic.accountName && extra.nick_name) {
    basic.accountName = extra.nick_name
  }

  if (!basic.accountAvatar && extra.hd_head_img) {
    basic.accountAvatar = extra.hd_head_img
  }

  const data = {
    account_name: basic.accountName,
    account_alias: accountAlias,
    account_avatar: basic.accountAvatar,
    account_description: accountDesc,
    account_id: basic.accountId,
    account_biz: basic.accountBiz,
    account_biz_number: basic.accountBizNumber,
    account_qr_code: `https://open.weixin.qq.com/qr/code?username=${basic.accountId || accountAlias}`,
    ...post
  }

  // 空字段置为 null
  for (let i in data) {
    if (data[i] === '') {
      data[i] = null
    }
  }

  // 文字类型
  if (!data.msg_title && data.msg_type === 'post') {
    data.msg_type = 'text'
    const title = $("meta[property='og:title']").attr("content")
    const desc = $("meta[property='og:description']").attr("content")
    if (title) {
      data.msg_title = title
      const rawContent = $('#js_panel_like_title').html()
      // 使用有换行格式
      if (rawContent) {
        data.msg_content = rawContent.trim().replace(/\n/g, '<br/>')
      } else {
        data.msg_content = title
      }
    }
    // 可以没有标题，https://mp.weixin.qq.com/s?__biz=MjM5NDcwOTk3NQ==&mid=2651469811&idx=1&sn=21843009d7489a71597476b3fa59e6ca&chksm=bd7d3f4b8a0ab65d53371e763c1cd528df420aac9f3cbed2043d860b4bc7244207076a25a9b5#rd
    if (!title && desc) {
      data.msg_title = desc
    }
  }

  // 时间参数兜底
  if (!data.msg_publish_time) {
    const matched = html.match(/d.ct.=."(\d+)"/)
    if (matched && matched[1]) {
      data.msg_publish_time = new Date(matched[1] * 1000)
      data.msg_publish_time_str = dayjs(data.msg_publish_time).format('YYYY/MM/DD HH:mm:ss')
    }
  }

  // 链接参数
  if (!data.msg_mid || !data.msg_link) {
    let url = null
    if (options.url && /biz/.test(options.url)) {
      url = options.url
    }

    if (!url) {
      if (rawUrl) {
        url = rawUrl
      }
    }

    if (!url) {
      url = $("meta[property='og:url']").attr("content")
    }

    if (url && /^http/.test(url) && /mid/.test(url) && /__biz/.test(url)) {
      url = url.replace(/&amp;/g, '&')
      if (!data.msg_link) {
        data.msg_link = url
      }
      if (!data.msg_mid) {
        data.msg_mid = getParameterByName('mid', url)
      }

      if (!data.msg_idx) {
        data.msg_idx = getParameterByName('idx', url)
      }

      if (!data.msg_sn) {
        data.msg_sn = getParameterByName('sn', url)
      }
    }
  }

  // 标题 entities 处理
  data.msg_title = unescape(data.msg_title)

  // 视频
  if (data.msg_type === 'video') {
    if (!data.msg_content) {
      data.msg_content = data.msg_title
    } else {
      data.msg_content = data.msg_content.replace(/\\x26/g, '&')
      data.msg_content = data.msg_content.replace(/\\x0a/g, '<br/>')
      data.msg_content = convertHtml(data.msg_content)
    }
  }

  if (!data.msg_title || !data.msg_publish_time) {
    return getError(1001)
  }

  // 文字类型没有内容，使用标题
  if (type === 'text' && !data.msg_content && data.msg_title) {
    data.msg_content = data.msg_title
  }

  // 图片类型时使用图片+文字
  if (type === 'image') {
    data.msg_content = `<img src="${data.msg_cover}" style="max-width:100%"/><br>${data.msg_title}`
  }

  if (shouldExtractMpLinks) {
    const mpLinks = []
    const $links = $('a')
    $links.each((i, ele) => {
      const $one = $(ele)
      const href = $one.attr('href')
      if (href && href.includes('mp.weixin.qq.com')) {
        mpLinks.push({
          title: $one.text(),
          href: href
        })
      }
    })
    data.mp_links_count = mpLinks.length
    data.mp_links = mpLinks
  }

  if (shouldExtractTags) {
    const tags = []
    const $items = $('.article-tag__item-wrp')
    if ($items.length) {
      $items.each((i, ele) => {
        const $this = $(ele)
        try {
          const url = $this.attr('data-url')
          const name = $this.find('.article-tag__item').text()
          let count = $this.find('.article-tag__item-num').text()
          if (name) {
            if (!count && $items.length === 1) {
              const $count = $('.article-tag-card__right')
              if ($count.length) {
                count = $count.text().replace('个', '')
              }
            }
            tags.push({
              id: getParameterByName('album_id', url) || getParameterByName('tag_id', url) || null,
              url,
              name: name.replace(/^#/, ''),
              count: count.replace(/\D/g,'') * 1
            })
          }
        } catch (e) {
          console.log(e)
        }
      })
    }
    data.tags = tags
  }

  if (shouldExtractRepostMeta) {
    if (html.includes('copyright_info') && html.includes('original_primary_nickname')) {
      const name = $('.original_primary_nickname').text()
      if (name) {
        data.repost_meta = {
          account_name: name
        }
      }
    }
  }

  if (data.msg_link && data.msg_link.includes('&amp;')) {
    data.msg_link = data.msg_link.replace(/&amp;/g, '&')
  }

  return {
    code: 0,
    done: true,
    data: data
  }
}

function convertHtml(text) {
  const target = ["&#39;", "'", "&quot;", '"', "&nbsp;", " ", "&gt;", ">", "&lt;", "<", "&yen;", "¥", "&amp;", "&"]
  for (var i = 0, str = text; i < target.length; i += 2) {
    str = str.replace(new RegExp(target[i], 'g'), target[i + 1])
  }
  return str
}

module.exports = {
  extract
}
