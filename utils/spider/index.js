let request = require('request');
let syncRequest = require('sync-request');
let fs = require('fs-sync');

function getCacheFile(url) {
    return 'cache\\' + url.replace(/\//g, '.').replace(/\?/g, '.').replace(/:/g, '.').replace(/=/g, '.')
}

function getCache(url) {
    const file = getCacheFile(url);
    if (fs.exists(file)) {
        return fs.read(file);
    }
    return null;
}

function writeCache(url, data) {
    const file = getCacheFile(url);
    if (!fs.exists('cache')) {
        fs.mkdir('cache');
    }

    fs.write(file, data);
}

function getString(str, start, end, index = 0) {
    let startPos;
    if (start) {
        startPos = str.indexOf(start, index);
        if (startPos === -1) {
            return null;
        }
    } else {
        startPos = 0;
        start = '';
    }

    let endPos;
    if (end) {
        endPos = str.indexOf(end, startPos + start.length);
        if (endPos === -1) {
            return null;
        }
    } else {
        endPos = str.length;
    }

    return {
        value: str.substr(startPos + start.length, endPos - startPos - start.length),
        position: endPos
    };
}

function getHttp(url, disableCache) {
    if (!disableCache) {
        const data = getCache(url);
        if (data) {
            return data;
        }
    }

    const res = syncRequest('GET', url);
    const body = res.getBody('utf-8');
    writeCache(url, body);
    return body;
}

function getHttpAsync(url, func) {
    request(url, function (error, response, body) {
        if (error) {
            console.log(error);
            return;
        }

        func(body);
    });
}

// 真光基督教会

const content = getHttp('http://www.seattletruelight.org/index.php/Media_sermons', true);
let body = getString(content, '<!-- bodytext -->', '<!-- /bodytext -->');

const sermons = body.value.split('<br />');
for (let line in sermons) {
    const row = sermons[line].trim().replace('<p>', '').replace('&nbsp;', '').replace('&amp;', '&');

    // get date (m/d/y -> y/m/d)
    let result = getString(row, null, ' ');
    let date = result.value.trim();
    let mdy = date.split('/');
    date = `${mdy[2]}/${mdy[0]}/${mdy[1]}`;

    // get mp3 file link
    result = getString(row, '<a href="/index.php/File', null);
    const fileLink = getString(result.value, ':', '"');
    let link;
    if (fileLink) {
        const fileLinkBody = getHttp('http://www.seattletruelight.org/index.php/File:' + fileLink.value);
        const fileLinkValue = getString(fileLinkBody, '<a href="/images', '"');
        link = `http://www.seattletruelight.org/images${fileLinkValue.value}`;
    } else {
        link = '';
    }

    let speakerValue = getString(result.value, '</a>', ':');
    let speaker;
    if (!speakerValue) {
        speakerValue = getString(result.value, '</a>', ')');
        if (speakerValue) {
            speaker = speakerValue.value + ')';
        } else {
            speakerValue = getString(result.value, '</a>');
            speaker = speakerValue.value;
        }
    } else {
        speaker = speakerValue.value;
    }

    const title = result.value.substr(speakerValue.position + 1).replace("'", "''").replace('&nbsp;', '');

    console.log(`INSERT INTO sermons(church, date, speaker, title, link) VALUES('1', '${date.trim()}', '${speaker.trim()}', '${title.trim()}', '${link.trim()}');`);
}
