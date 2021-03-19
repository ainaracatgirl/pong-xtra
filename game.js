import * as uuid from 'https://jspm.dev/uuid';

const content = document.getElementById('content');

window.newroom = () => {
    location.search = "?room=" + uuid.v4();
}

function parseQuery(queryString) {
    let query = {};
    let pairs = (queryString[0] === '?' ? queryString.substr(1) : queryString).split('&');
    for (let i = 0; i < pairs.length; i++) {
        let pair = pairs[i].split('=');
        query[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1] || '');
    }
    return query;
}
const q = parseQuery(location.search);
const userid = uuid.v4();

let gamepts = {
    left: 0,
    right: 0
};

let gameinfo = {
    left: 240,
    right: 240,
    ballX: 320,
    ballY: 240,
    ballMX: -1,
    ballMY: -1,
    
    ballSpeed: 256
};

let keys = {};
window.onkeydown = (e) => {
    keys[e.key] = true;
}
window.onkeyup = (e) => {
    keys[e.key] = false;
}

function rectcircle(circle, rect) {
    let distX = Math.abs(circle.x - rect.x-rect.w/2);
    let distY = Math.abs(circle.y - rect.y-rect.h/2);

    if (distX > (rect.w/2 + circle.r)) { return false; }
    if (distY > (rect.h/2 + circle.r)) { return false; }

    if (distX <= (rect.w/2)) { return true; } 
    if (distY <= (rect.h/2)) { return true; }

    let dx=distX-rect.w/2;
    let dy=distY-rect.h/2;
    return (dx*dx+dy*dy<=(circle.r*circle.r));
}

function checkPaddleCollision(px, py) {
    const bx = gameinfo.ballX;
    const by = gameinfo.ballY;

    return rectcircle({x: bx, y: by, r: 16}, {x: px, y: py, w: 24, h: 128});
}

let lastnow = undefined;
function rungame(now) {
    if (!lastnow) lastnow = now;
    const deltaTime = (now - lastnow) / 1000;
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 640, 480);

    ctx.fillStyle = 'white';
    ctx.fillRect(16, gameinfo.left - 64, 24, 128);
    ctx.fillRect(640 - 16 - 24, gameinfo.right - 64, 24, 128);

    ctx.beginPath();
    ctx.arc(gameinfo.ballX, gameinfo.ballY, 16, 0, 2 * Math.PI, false);
    ctx.fill();

    ctx.font = "24px sans-serif";
    ctx.fillText(`${gamepts.left} | ${gamepts.right}`, 320, 24);

    gameinfo.ballX += gameinfo.ballMX * gameinfo.ballSpeed * deltaTime;
    gameinfo.ballY += gameinfo.ballMY * gameinfo.ballSpeed * deltaTime;

    if (gameinfo.ballY < 16) gameinfo.ballMY *= -1;
    if (gameinfo.ballY > 480 - 16) gameinfo.ballMY *= -1;

    if (checkPaddleCollision(16, gameinfo.left - 64) || checkPaddleCollision(640 - 16 - 24, gameinfo.right - 64)) {
        gameinfo.ballMX *= -1;
        gameinfo.ballSpeed *= 1.01;
    }

    if (gNET.isHost) {
        if (gameinfo.ballX < 16 || gameinfo.ballX > 640 - 16) {
            gNET.broadcast({
                ball: {
                    x: 320,
                    y: 240,
                    mx: gameinfo.ballX < 16 ? 1 : -1,
                    my: Math.random() < 0.5 ? -1 : 1,
                    speed: 256
                },
                pts: {
                    left: gamepts.left + (gameinfo.ballX < 16 ? 0 : 1),
                    right: gamepts.right + (gameinfo.ballX < 16 ? 1 : 0)
                }
            });
        }
    }

    if (gNET.isHost) {
        if (keys['ArrowUp']) {
            gameinfo.left -= 256 * deltaTime;
        }
        if (keys['ArrowDown']) {
            gameinfo.left += 256 * deltaTime;
        }

        gNET.send({
            paddle: {
                left: gameinfo.left
            }
        });
    } else {
        if (keys['ArrowUp']) {
            gameinfo.right -= 256 * deltaTime;
        }
        if (keys['ArrowDown']) {
            gameinfo.right += 256 * deltaTime;
        }

        gNET.send({
            paddle: {
                right: gameinfo.right
            }
        });
    }

    lastnow = now;
    requestAnimationFrame(rungame);
}

if (q.room) {
    console.log("Room => " + q.room);
    console.log("UserID => " + userid);
    
    gNET.connect("JanCraft/pongxtra-" + q.room, userid);
    gNET.on('client/packet', ({data, source}) => {
        gNET.broadcast({source, data});
    });
    gNET.on('host/packet', ({data}) => {
        if (data.time != undefined) {
            content.innerHTML = `
                <h3>Starting in ${data.time}s</h3>
            `;
            if (data.time == 0) {
                content.innerHTML = `
                    <canvas id="game" width="640" height="480"></canvas>
                `;
                requestAnimationFrame(rungame);
            }
        }
        if (data.data?.paddle) {
            if (data.data?.paddle.left && !gNET.isHost) gameinfo.left = data.data?.paddle.left;
            if (data.data?.paddle.right && gNET.isHost) gameinfo.right = data.data?.paddle.right;
        }
        if (data.ball) {
            gameinfo.ballX = data.ball.x;
            gameinfo.ballY = data.ball.y;
            gameinfo.ballMX = data.ball.mx;
            gameinfo.ballMY = data.ball.my;
            gameinfo.ballSpeed = data.ball.speed;
        }

        if (data.pts) {
            gamepts.left = data.pts.left;
            gamepts.right = data.pts.right;
        }
    });
    let tout = -1;
    gNET.on('control/connection', () => {
        gNET.broadcast({time: 5});
        if (tout > 0) clearTimeout(tout);
        tout = setTimeout(() => {
            gNET.broadcast({time: 4});
            tout = setTimeout(() => {
                gNET.broadcast({time: 3});
                tout = setTimeout(() => {
                    gNET.broadcast({time: 2});
                    tout = setTimeout(() => {
                        gNET.broadcast({time: 1});
                        tout = setTimeout(() => {
                            gNET.broadcast({time: 0});
                        }, 1000);
                    }, 1000);
                }, 1000);
            }, 1000);
        }, 1000);
    });
    
    content.innerHTML = `
        <img src="/favicon.png">
        <h3>Waiting for another player...</h3>
    `;
} else {
    content.innerHTML = `
        <img src="/favicon.png">
        <h1>Pong XTRA</h1>
        <h3>An online-multiplayer pong game</h3>
        <br>
        <small>
            When creating a new room, send the other player the URL of the website to play.
        </small>
        <br>
        <button onclick="newroom()">New room</button>
    `;
}