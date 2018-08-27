const extract = function (html) {
  const reg = new RegExp(`var\\smsgList\\s=\\s([\\s\\S]*?).*;`, 'g')
  const match = html.match(reg)
  if (!match) {
    return {
      done: false
    }
  }
  const data = match[0].replace('var msgList = ', '').replace('};', '}')
  const list = JSON.parse(data).list

  let lastPostedAt = null

  const items = []
  for (let i = 0; i < list.length; i++) {
    const post = list[i]
    const datetime = post.comm_msg_info.datetime

    if (i === 0) {
      lastPostedAt = datetime
    }

    items.push({
      datetime,
      content_url: appendDomain(post.app_msg_ext_info.content_url),
      title: post.app_msg_ext_info.title,
      digest: post.app_msg_ext_info.digest || null
    })

    const subList = post.app_msg_ext_info.multi_app_msg_item_list
    if (Array.isArray(subList) && subList.length) {
      subList.forEach(item => {
        items.push({
          datetime,
          content_url: appendDomain(item.content_url),
          title: item.title,
          digest: item.digest || null
        })
      })
    }
  }

  return {
    done: true,
    data: {
      last_posted_at: lastPostedAt,
      list: items,
      raw_list: list
    }
  }
}

function appendDomain (url) {
  if (!/^http/.test(url)) {
    url = 'https://mp.weixin.qq.com' + url
  }
  return url
}

module.exports = extract