const dayjs = require('dayjs')
const request = require('request-promise')
const cheerio = require('cheerio')
const parseUrl = require('./parse-wechat-url')
const errors = require('./errors')
const extractProfile = require('./extract-profile')

const defaultConfig = {
  shouldReturnRawMeta: false,
  shouldReturnContent: true
}

const getError = function (code) {
  return {
    done: false,
    code: code,
    msg: errors[code]
  }
}

const extract = async function (html, options = {}) {
  const { shouldReturnRawMeta, shouldReturnContent } = Object.assign({}, defaultConfig, options)

  let paramType = 'HTML' // 参数为 URL 还是 HTML

  let type = 'post'
  let hasCopyright = false
  let shareContentTpl

  if (!html) {
    return getError(2001)
  }

  // 支持地址
  if (/^http/.test(html)) {
    if (!/http(s?):\/\/mp.weixin.qq.com/.test(html)) {
      return getError(2009)
    }
    paramType = 'URL'
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
          'Host': 'mp.weixin.qq.com'
        }
      })
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
    const match = html.match(/var\stransfer_target_link\s=\s'(.*?)';/)
    const link = match[1]
    if (link) {
      return await extract(link)
    } else {
      return getError(2005)
    }
  } else if (html.includes('该内容已被发布者删除')) {
    return getError(2005)
  } else if (html.includes('此内容因违规无法查看')) {
    return getError(2006)
  } else if (html.includes('此内容发送失败无法查看')) {
    return getError(2007)
  } else if (!html.includes('id="js_content"')) {
    return getError(1000)
  }

  html = html.replace('>微信号', ' id="append-account-alias">微信号')
  .replace('>功能介绍', ' id="append-account-desc">功能介绍')
  .replace(/\n\s+<script/g, '\n\n<script')

  const $ = cheerio.load(html)

  // 原创
  if ($('#copyright_logo') && $('#copyright_logo').text().includes('原创')) {
    hasCopyright = true
  }

  // 检查是否为视频类型
  const hasVideo = $('#js_content .video_card_context')
  if (hasVideo.length) {
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

  let accountName = $('.profile_nickname').text()

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

  let accountId = ''
  let accountAvatar = ''

  let accountBiz = null
  let accountBizNumber = null

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
  for (let i = 0; i < rs.length; i++) {
    const script = rs[i]

    if (!extractExtra) {
      // biz
      const extra = {
        biz: null,
        sn: null,
        mid: null,
        idx: null
      }
      const extraFields = Object.keys(extra)

      extraFields.forEach(field => {
        const reg = new RegExp(`var\\s+${field}\\s*=`)
        if (reg.test(script)) {
          try {
            const line = script.split('\n').filter(one => reg.test(one))
            const fn = new Function(`${line} \n return ${field}`)
            extra[field] = fn()
          } catch (e) {
            console.log(e)
          }
          if (!extractExtra) {
            extractExtra = true
          }
        }
      })

      if (extractExtra) {
        accountBiz = extra.biz
        if (accountBiz) {
          accountBizNumber = Buffer.from(accountBiz, 'base64').toString() * 1
        }

        post.msg_sn = extra.sn || null
        post.msg_idx = extra.idx ? extra.idx * 1 : null
        post.msg_mid = extra.mid ? extra.mid * 1 : null
      }
    }

    // 视频
    if ((type === 'video' || type === 'image' || type === 'voice') && script.includes('d.title =')) {
      const lines = script.split('\n')
      let code = lines.filter(line => !!line.trim())
      code = code.slice(2, code.length - 2).join('\n').replace('var d = _g.cgiData;', 'var d = {}') + '\n  return d;'
      let data = {}
      try {
        const fn = new Function(code)
        data = fn()
        accountName = data.nick_name
        accountAvatar = data.hd_head_img
        accountId = data.user_name

        // biz
        if (!accountBiz && data.biz) {
          accountBiz = data.biz
          accountBizNumber = Buffer.from(accountBiz, 'base64').toString() * 1
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
          const vid = html.match(/vid\s*:\s*"(.*?)"/)[1]
          if (vid) {
            data.vid = vid
            post.msg_source_url = 'http://v.qq.com/x/page/' + vid + '.html'
            if (!post.msg_cover) {
              post.msg_cover = `https://vpic.video.qq.com/60643382/${vid}.png`
            }
          }
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
      let code = lines.slice(1, lines.length - 2).filter(line => {
        return !line.includes('var title')
      }).map(line => {
        // 特殊符号可能会导致解析出 bug
        if (/var\s+msg_desc/.test(line)) {
          line = line.replace(/`/g, "'")
          line = line.replace(/"/g, '`')
        }
        return line
      }).join('\n')
      code = 'var window = {};\n' + code

      let rs = 'var rs = {'
      code.match(/var\s(.*?)\s=/g).map(key => key.split(' ')[1]).forEach(key => {
        if (key !== 'window') {
          rs += `"${key}": ${key},`
        }
      })

      rs += '\n}\n return rs \n'

      code += rs
      let data = {}
      try {
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
      accountId = data.user_name
      accountAvatar = data.ori_head_img_url

      if (!accountName && data.nickname) {
        accountName = data.nickname
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

  post.msg_type = type

  // 有可能 ori_head_img_url 不存在，避免被设置成 /132
  if (post.ori_head_img_url && post.ori_head_img_url.length < 10) {
    post.ori_head_img_url = null
  }

  // 新注册公众号没有头像，置为 null
  if (accountAvatar.length < 10) {
    accountAvatar = null
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

     const $$ = cheerio.load(html)
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

  // 音频拼接 id
  if (type === 'voice') {
    const rs = html.match(/[\s\S]*?voiceid\s*:\s*['|"](\w+)['|"]/)
    if (rs && rs[1]) {
      post.msg_source_url = `https://res.wx.qq.com/voice/getvoice?mediaid=${rs[1]}`
    }
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
    console.log(rs)

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
    post.msg_content = post.msg_content.trim().replace(/\n/g,"<br>")
  }

  const data = {
    account_name: accountName,
    account_alias: accountAlias,
    account_avatar: accountAvatar,
    account_description: accountDesc,
    account_id: accountId,
    account_biz: accountBiz,
    account_biz_number: accountBizNumber,
    account_qr_code: `https://open.weixin.qq.com/qr/code?username=${accountId}`,
    ...post
  }

  // 空字段置为 null
  for (let i in data) {
    if (data[i] === '') {
      data[i] = null
    }
  }

  if (!data.msg_title || !data.msg_publish_time) {
    return getError(1001)
  }

  return {
    code: 0,
    done: true,
    data: data
  }
}

module.exports = {
  extract,
  extractProfile
}
