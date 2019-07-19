const extract = require('.').extract
const assert = require('assert')
const fs = require('fs')

;(async function () {
  // const url = fs.readFileSync('./links/post.html', 'utf-8')
  // const postRs = await extract(url, {
  //   shouldReturnContent: false
  // })
  //
  // console.log(postRs)
  //
  // const expected = {
  //   account_name: '微信派',
  //   account_alias: 'wx-pai',
  //   account_id: 'gh_bc5ec2ee663f',
  //   account_biz: 'MjM5NjM4MDAxMg==',
  //   account_biz_number: 2396380012,
  //   account_qr_code: 'https://open.weixin.qq.com/qr/code?username=gh_bc5ec2ee663f',
  //   msg_has_copyright: false,
  //   msg_content: null,
  //   msg_author: null,
  //   msg_sn: '9a0a54f2e7c8ac4019812aa78bd4b3e0',
  //   msg_idx: 1,
  //   msg_mid: 2655078412,
  //   msg_title: '重磅 | 微信订阅号全新改版上线！',
  //   msg_desc: '今后，头图也很重要',
  //   msg_link: 'http://mp.weixin.qq.com/s?__biz=MjM5NjM4MDAxMg==&amp;mid=2655078412&amp;idx=1&amp;sn=9a0a54f2e7c8ac4019812aa78bd4b3e0&amp;chksm=bd5fc40f8a284d19360e956074ffced37d8e2d78cb01a4ecdfaae40247823e7056b9d31ae3ef#rd',
  //   msg_source_url: null,
  //   msg_cover: 'http://mmbiz.qpic.cn/mmbiz_jpg/OiaFLUqewuIDldpxsV3ZYJzzyH9HTFsSwOEPX82WEvBZozGiam3LbRSzpIIKGzj72nxjhLjnscWsibDPFmnpFZykg/0?wx_fmt=jpeg',
  //   msg_article_type: null,
  //   msg_publish_time_str: '2018/06/20 18:52:35',
  //   msg_type: 'post'
  // }
  // for (let i in expected) {
  //   assert(postRs.data[i] === expected[i])
  // }
  //
  // const link001 = fs.readFileSync('./links/quota_limit.html', 'utf-8')
  // const res001 = await extract(link001)
  // console.log(res001)
  // assert(res001.code === 2010)
  //
  // const imageUrl = fs.readFileSync('./links/image.html', 'utf-8')
  // const imageRs = await extract(imageUrl)
  //
  // console.log(imageRs)
  //
  // const videoUrl = fs.readFileSync('./links/video.html', 'utf-8')
  // const videoRs = await extract(videoUrl)
  //
  // console.log(videoRs)
  //
  // const documentWriteUrl = fs.readFileSync('./links/document.write.html', 'utf-8')
  // const documentWriteRs = await extract(documentWriteUrl)
  //
  // console.log(documentWriteRs)
  //
  // const _20181021WriteUrl = fs.readFileSync('./links/20181021.issue.html', 'utf-8')
  // const _20181021WriteRs = await extract(_20181021WriteUrl)
  //
  // console.log(_20181021WriteRs)

  // const issue3WriteUrl = fs.readFileSync('./links/issue3.html', 'utf-8')
  // const issue3WriteRs = await extract(issue3WriteUrl)

  // console.log(issue3WriteRs)

  // const sogou = await extract('https://mp.weixin.qq.com/s?src=3&timestamp=1559431337&ver=1&signature=K*8sgrrv9y5KoQr22U2gh3Tut0DIldkcZ67t4Oc3BzcyNEQMtX3l459-K2JvxxeLvWbdhtjtuzSWorY-zsW-Nm2Rloy30WAJi82JmQGYI2GlWpIcFuXNh53g1jY*Dh8XRczrRrjewQgRj*N1Kg8FK0j5W-3wb*NdM3JzzhO4jWc=')

  // console.log(sogou)

  const url = fs.readFileSync('./links/20190719002.html', 'utf-8')
  const postRs = await extract(url, {
    shouldReturnContent: false
  })

  console.log(postRs)

})()
