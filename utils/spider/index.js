let request = require('request');
let syncRequest = require('sync-request');
let fs = require('fs-sync');

function getSqlData(data) {
    return data.replace("'", "''").replace('&nbsp;', '');
}

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
function parseTrueLight() {
    const content = getHttp('http://www.seattletruelight.org/index.php/Media_sermons', true);
    let body = getString(content, '<!-- bodytext -->', '<!-- /bodytext -->');

    const sermons = body.value.split('<br />');
    for (let line in sermons) {
        const row = sermons[line].trim().replace('<p>', '').replace('&nbsp;', '').replace('&amp;', '&');

        // get date (m/d/y -> y/m/d)
        let result = getString(row, null, ' ');
        let date = result.value.trim();
        let mdy = date.split('/');
        if (mdy.length !== 3) {
            continue;
        }
        date = `${parseInt(mdy[2])}/${parseInt(mdy[0])}/${parseInt(mdy[1])}`;

        // get mp3 file link
        result = getString(row, '<a href="/index.php', null);
        const fileLink = getString(result.value, ':', '"');
        let link = '';
        if (fileLink) {
            const fileLinkBody = getHttp('http://www.seattletruelight.org/index.php/File:' + fileLink.value);
            const fileLinkValue = getString(fileLinkBody, '<a href="/images', '"');
            if (fileLinkValue) {
                link = `http://www.seattletruelight.org/images${fileLinkValue.value}`;
            }
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

        const title = result.value.substr(speakerValue.position + 1);

        console.log(`REPLACE INTO sermons(church, date, speaker, title, audio) VALUES('1', '${getSqlData(date)}', '${getSqlData(speaker)}', '${getSqlData(title)}', '${getSqlData(link)}');`);
    }
}

// Bread of Life Christian Church in Seattle 西雅圖靈糧堂
function parseSeaBOL() {
    const content = getHttp('https://www.youtube.com/channel/UC3pFaSxaAYKUtecq_dxd6SA/videos', true);

    const sermons = content.split('"yt-lockup-content"');
    for (let line in sermons) {
        const row = sermons[line].trim().replace('<p>', '').replace('&nbsp;', '').replace('&amp;', '&');
        if (row.indexOf('主日證道') === -1) {
            continue;
        }

        // Format#1: [走出生命的低谷 - 胡耀文牧師] 西雅圖靈糧堂 主日證道 2018-12-16
        // Format#2: 【The Head and the Body [Ephesians 4:1-16] - Pastor Picchi】西雅圖靈糧堂 主日證道 2018-04-29
        let titleValue = getString(row, 'title="', '"');

        // get link
        let videoId = getString(row, 'href="/watch?v=', '"');
        const video = 'https://www.youtube.com/embed/' + videoId.value;

        // get date
        let result = getString(row, '主日證道 ', '"');
        let date = result.value.trim();
        let mdy = date.split(/[-\/]/);
        if (mdy.length !== 3) {
            continue;
        }
        date = `${mdy[0]}/${mdy[1]}/${mdy[2]}`;

        let title;
        if (titleValue.value[0] === '【') {
            title = getString(titleValue.value, '【', '】');
        } else if (titleValue.value[0] === '[') {
            title = getString(titleValue.value, '[', ']');
        } else {
            console.error('Unknown format!');
            continue;
        }

        const pos = title.value.lastIndexOf('-');
        if (pos === -1) {
            console.error('Unknown format!');
            console;
        }

        const speaker = title.value.substr(pos + 1).trim();
        title = title.value.substr(0, pos - 1).trim();

        console.log(`REPLACE INTO sermons(church, date, speaker, title, video) VALUES('2', '${getSqlData(date)}', '${getSqlData(speaker)}', '${getSqlData(title)}', '${getSqlData(video)}');`);
    }
}

// 東區基督教會
function parseEccc() {
    const content = getHttp('http://eccc.net/Cn/Worship/Worship_2018_tr.htm', true);

    const sermons = content.split('<tr');
    for (let line in sermons) {
        const row = sermons[line].trim().replace('<p>', '').replace('&nbsp;', '').replace('&amp;', '&');
        if (row.indexOf('<span class="english">') === -1) {
            continue;
        }

        const data = row.split('</td>');

        // get date
        let result = getString(data[0], '<span class="english">', '<');
        let date = result.value.trim();
        let mdy = date.split(/[-\/]/);
        if (mdy.length !== 3) {
            continue;
        }
        date = `${mdy[2]}/${mdy[0]}/${mdy[1]}`;

        // title
        result = getString(data[1], '<td>');
        const title = result.value.trim();

        // speaker
        result = getString(data[2], '<td>');
        const speaker = result.value.trim();

        // get video link
        let video = '';
        let videoValue = getString(data[3], '<a href="', '" ');
        if (videoValue) {
            video = 'http://eccc.net' + videoValue.value;
        }

        // get audio link
        let audio = '';
        let audioValue = getString(data[5], '<a href="', '" ');
        if (audioValue) {
            audio = 'http://eccc.net' + audioValue.value;
        }

        console.log(`REPLACE INTO sermons(church, date, speaker, title, video, audio) VALUES('3', '${getSqlData(date)}', '${getSqlData(speaker)}', '${getSqlData(title)}', '${getSqlData(video)}', '${getSqlData(audio)}');`);
    }
}

// Main
parseTrueLight();
parseSeaBOL();
parseEccc();