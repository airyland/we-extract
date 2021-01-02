# we-extract

## 介绍

`we-extract` 用以解析微信公众号文章的账号及文章信息，居家旅行、采集微信公众号文章必备工具。

`we-extract` 是微信公众号 RSS 订阅服务 `WeRss` 的核心解析工具，欢迎使用：

<p align="center">
  <br>
  <a href="https://werss.app?utm_source=we-extract-github">
    <img src="https://cdn.weapp.design/werss/werss-logo.png" width="250">
  </a>
</p>

## 安装

```
npm install we-extract

// or

yarn add we-extract
```

## 使用

> Node 版本需要支持 async


``` js
const extract = require('we-extract').extract

const rs = await extract('微信文章 url 或者 文章内容')

// 选项
const rs = await extract('微信文章 url 或者 文章内容', {
  shouldReturnContent: true, // 是否返回内容，默认返回
  shouldExtractMpLinks: false // 是否返回文章中出现的所有公众号文章链接，如果为 true，将返回 mp_links 数组。
})
```

## 返回结果说明


> 正确返回

``` js
{
  done: true,
  code: 0,
  data: {
    account_name: '微信派',
    account_alias: 'wx-pai',
    account_avatar: 'http://wx.qlogo.cn/mmhead/Q3auHgzwzM7Xb5Qbdia5AuGTX4AeZSWYlv5TEqD1FicUDOrnEIwVak1A/132',
    account_description: '微信第一手官方活动信息发布，线下沙龙活动在线互动平台。独家分享微信公众平台优秀案例，以及权威专家的精彩观点。',
    account_id: 'gh_bc5ec2ee663f',
    account_biz: 'MjM5NjM4MDAxMg==',
    account_biz_number: 2396380012,
    account_qr_code: 'https://open.weixin.qq.com/qr/code?username=gh_bc5ec2ee663f',
    msg_has_copyright: false, // 是否原创
    msg_content: '省略的文章内容',
    msg_author: null, // 作者
    msg_sn: '9a0a54f2e7c8ac4019812aa78bd4b3e0',
    msg_idx: 1,
    msg_mid: 2655078412,
    msg_title: '重磅 | 微信订阅号全新改版上线！',
    msg_desc: '今后，头图也很重要',
    msg_link: 'http://mp.weixin.qq.com/s?__biz=MjM5NjM4MDAxMg==&amp;mid=2655078412&amp;idx=1&amp;sn=9a0a54f2e7c8ac4019812aa78bd4b3e0&amp;chksm=bd5fc40f8a284d19360e956074ffced37d8e2d78cb01a4ecdfaae40247823e7056b9d31ae3ef#rd',
    msg_source_url: null, // 音频，视频时，此处为音频、视频链接
    msg_cover: 'http://mmbiz.qpic.cn/mmbiz_jpg/OiaFLUqewuIDldpxsV3ZYJzzyH9HTFsSwOEPX82WEvBZozGiam3LbRSzpIIKGzj72nxjhLjnscWsibDPFmnpFZykg/0?wx_fmt=jpeg',
    msg_article_type: null, // 文章分类
    msg_publish_time: '2018-06-20T10:52:35.000Z', // date 类型
    msg_publish_time_str: '2018/06/20 18:52:35',
    msg_type: 'post', // 可能为 post text repost voice video image
    mp_links: [{ // 在 shouldExtractMpLinks = true 时返回
      title: '',
      href: ''
    }]
  }
}
```

> 错误返回

``` js
{
  done: false,
  code: 2002,
  msg: '链接已过期'
}
```

## 常见错误

`we-extract` 定义了详细的错误信息方便开发和出错处理，`1` 开头错误表示可能需要重试(或者暂时将内容保存下来 debug)，`2` 表示没有疑问的错误，可以不处理。

请使用 code(数字类型) 来判断而不是 message 内容，因为 message 可能会变化。

``` js
module.exports = {
  '1000': '解析失败，可能文章内容不完整',
  '1001': '字段缺失',
  '1002': '请求文章内容失败',
  '1003': '请求文章内容为空',
  '1004': '访问过于频繁(URL模式)', // 可以换 ip 重新请求，注意与 2010 的区别
  '1005': 'js 变量解析出错',

  '2001': '参数缺失',
  '2002': '链接已过期',
  '2003': '该内容被投诉且经审核涉嫌侵权，无法查看',
  '2004': '公众号迁移但文章未同步',
  '2005': '该内容已被发布者删除',
  '2006': '此内容因违规无法查看',
  '2007': '涉嫌违反相关法律法规和政策发送失败',
  '2008': '微信文章系统出错',
  '2009': '链接不正确',
  '2010': '访问过于频繁(HTML模式)', // 解析参数为直接的文章内容，此时该篇内容已经无效，可以丢弃
  '2011': '由用户投诉并经平台审核，涉嫌过度营销、骚扰用户',
  '2012': '此帐号已被屏蔽',
  '2013': '此帐号已自主注销',
  '2014': '不实信息'
}

```

## 经验

+ 一个微信由 biz+mid+idx 组成，mid 在单个公众号内唯一。
+ 文章所属账号信息以文章解析结果为准，采集搜狗时不要相信账号名字，因为搜狗显示的可能是改名或者迁移前的账号信息。
+ 如果在搜狗微信搜不到账号，极有可能是因为公众号改了名字，试试以前的名字应该能搜索到。
+ 微信链接的 search 拼接符可能为 `&amp;` 需要做一个替换处理，否则解析链接参数时会有问题。
+ 一个 ip 获取微信文章内容有限制，需要限制速率或者轮换 ip。
