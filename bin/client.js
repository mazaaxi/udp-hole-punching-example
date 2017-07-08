const dgram = require('dgram');
const stun = require('stun');
const shell = require('shell');
const app = new shell({ chdir: __dirname })

let client = null;
let clientHost = '';
let clientPort = NaN;

//シェルの環境設定
app.configure(() => {
    app.use(shell.history({
        shell: app
    }));
    app.use(shell.completer({
        shell: app
    }));
    app.use(shell.router({
        shell: app
    }));
    app.use(shell.help({
        shell: app,
        introduction: true
    }));
});

//コマンド定義
app.cmd('run :host :port', 'Run client', (req, res, next) => {
    clientHost = req.params.host;
    clientPort = parseInt(req.params.port);

    // STUN Server (by Google)
    const stunPort = 19302;
    const stunHost = 'stun.l.google.com';

    // STUN Client
    client = stun.connect(stunPort, stunHost);
    client.on('error', (err) => {
        console.log('Error:', err);
        res.prompt();
    });
    client._socket.bind(clientPort);

    // Client: STUN Response event handler
    client.on('response', (packet) => {
        console.log('Received STUN packet:', packet);
        // Save NAT Address
        let natAddress = null;
        if (packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS]) {
            natAddress = packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS];
        } else {
            natAddress = packet.attrs[stun.attribute.MAPPED_ADDRESS];
        }
        console.log('Received NAT Address:', natAddress);
        res.prompt();
    });

    // Client: UDP Message event handler
    client.on('message', (msg, rinfo) => {
        console.log('Received UDP message:', msg.toString(), 'from', rinfo.address);
        res.prompt();
    });

    // Sending STUN request
    client.request(() => {
        console.log('Sending STUN packet');
    });
});

app.cmd('send :host :port :msg', 'Send message', (req, res, next) => {
    const destHost = req.params.host;
    const destPort = parseInt(req.params.port);
    const destMsg = req.params.msg;

    const msg = new Buffer(destMsg);
    client.send(msg, 0, msg.length, destPort, destHost);
    res.prompt();
});