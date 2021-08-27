// @ts-nocheck
const fs = require('fs')
const path = require('path')

const got = require('got')
const { escape } = require('html-escaper')
const { Notifier } = require('@airbrake/node')
const jsdom = require('jsdom')

const feedXMLFilePath = path.join(__dirname, 'feed.xml')
const feedJSONFilePath = path.join(__dirname, 'feed-items.json')
const airbrake = new Notifier({
  projectId: 276409,
  projectKey: 'a37b857c1f537e53a76666654aecb721',
  environment: 'production',
})

function updateFeed() {
  console.log(`Running updateFeed at ${new Date().toUTCString()}`)
  getRamdaPage()
    .then(parseHTML)
    .then(getRandomRamdaAdjunctMethod)
    .then(removeOldItemsInFeed)
    .then(createNewFeedItem)
    .then(updateJSONFeedItems)
    .then(updateFeedXMLFile)
    .catch(err => {
      console.error(err)
      airbrake.notify(err)
    })
}

function getRamdaPage() {
  return got('https://char0n.github.io/ramda-adjunct/2.33.0/RA.html')
}

function parseHTML({ body }) {
  return new jsdom.JSDOM(body)
}

function getRandomInt(min, max) {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function getRandomRamdaAdjunctMethod(dom) {
  const sections = dom.window.document.querySelectorAll('#main .section-id')
  const randomNumberInRange = getRandomInt(1, sections.length)
  const section = sections[randomNumberInRange]
  const name = section.nextElementSibling
  const details = name.nextElementSibling
  const description = details.nextElementSibling
  const h5_1 = description.nextElementSibling
  const pre = h5_1.nextElementSibling
  const h5_2 = pre.nextElementSibling
  const table = h5_2.nextElementSibling
  const h5_3 = table.nextElementSibling
  const defList = h5_3.nextElementSibling
  return [name, details, description, h5_1, pre, h5_2, table, h5_3, defList]
}

function removeOldItemsInFeed(section) {
  return fs.promises
    .readFile(feedJSONFilePath)
    .then(res => JSON.parse(res))
    .then(({ feedItems }) => {
      if (feedItems.length > 6) {
        feedItems.pop()
      }
      return [section, feedItems]
    })
}

function createNewFeedItem([[name, details, description, h5_1, pre, h5_2, table, h5_3, defList], feedItems]) {
  const typeSignature = name.textContent

  Array.from(name.children).forEach(item => item.remove())

  const methodName = name.textContent.trim()

  const link = `https://char0n.github.io/ramda-adjunct/2.33.0/RA.html#.${methodName}`

  const hasSeeAlso = !!details.querySelector('dd.tag-see')

  let seeAlso = ''

  if (hasSeeAlso) {
    Array.from(details.querySelector('dd.tag-see').querySelectorAll('a')).forEach(item => {
      if (item.href.startsWith('RA.html')) {
        item.href = `https://char0n.github.io/ramda-adjunct/2.33.0/${item.href}`
      }
    })
    seeAlso = details.querySelector('dd.tag-see')
  }

  const content = escape(
    `
    <h2><a href="${link}">${methodName}</a>
    <p><code>${typeSignature}</code></p>
    ${description.outerHTML}
    ${h5_1.outerHTML}
    ${pre.outerHTML}
    ${h5_2.outerHTML}
    ${table.outerHTML}
    ${h5_3.outerHTML}
    ${defList.outerHTML}
    ${hasSeeAlso ? `<dl><dt>See also:</dt>${seeAlso.outerHTML}<dl>` : ''}
    `
  )

  return [
    {
      title: `Ramda Adjunct: ${methodName}`,
      content,
      link,
      guid: link,
      pubDate: new Date().toISOString(),
    },
    feedItems,
  ]
}

function updateJSONFeedItems([newFeedItem, feedItems]) {
  feedItems.unshift(newFeedItem)
  return Promise.all([
    fs.promises.writeFile(feedJSONFilePath, JSON.stringify({ feedItems })),
    Promise.resolve(feedItems),
  ])
}

const generateFeedXML = feedItems => `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/css" href="https://ramda-adjunct-feeder.openode.io/feed-stylesheet.css" ?>
<feed xmlns="http://www.w3.org/2005/Atom">
    <updated>${new Date().toISOString()}</updated>
    <icon>https://ramda-adjunct-feeder.openode.io/favicon.ico</icon>
    <id>https://char0n.github.io/ramda-adjunct/2.33.0/</id>
    <link rel="self" href="https://ramda-adjunct-feeder.openode.io/feed" type="application/atom+xml" />
    <subtitle>Get a new Ramda Adjunct api method in your RSS feed each day.</subtitle>
    <title>Ramda Adjunct Daily Feed</title>
    ${feedItems.reduce(
      (acc, feedItem) => `${acc}
        <entry>
            <author>
                <name>${feedItem.link}</name>
                <uri>${feedItem.link}</uri>
            </author>
            <content type="html">${feedItem.content}</content>
            <id>${feedItem.guid}</id>
            <link href="${feedItem.link}" />
            <updated>${feedItem.pubDate}</updated>
            <title>${feedItem.title}</title>
        </entry>
        `,
      ''
    )}
</feed>
`

function updateFeedXMLFile([, feedItems]) {
  return fs.promises.writeFile(feedXMLFilePath, generateFeedXML(feedItems))
}

module.exports = {
  updateFeed,
}
