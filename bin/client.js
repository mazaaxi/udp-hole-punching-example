const dgram = require('dgram');
const stun = require('stun');
const shell = require('shell');
const ip = require('ip');
const os = require('os');
const app = new shell({ chdir: __dirname })

let client = null;

/**
 * シェル環境の設定を行います。
 */
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

/**
 * メッセージ送信/受信可能なクライアントを作成して立ち上げます。
 * コマンドの引数に0を指定した場合は適当なポートが割り当てられます。
 * コマンド例: run 9011
 */
app.cmd('run :port', '\tRun client', (req, res, next) => {
  // STUNサーバー (by Google)
  const stunPort = 19302;
  const stunHost = 'stun.l.google.com';

  // STUNクライアントを作成(このクライアントはメッセージの送信/受信も可能)
  client = stun.connect(stunPort, stunHost);
  client.on('error', (err) => {
    res.red('Error:', err);
    res.prompt();
  });
  const clientSocket = client._socket;
  const clientPort = parseInt(req.params.port);
  if (clientPort) {
    clientSocket.bind(clientPort); // コマンドでポートが指定された場合にのみバインド
  }

  // 端末のIPとポートの一覧をコンソール出力
  const interfaces = os.networkInterfaces();
  const clientAddresses = [];
  Object.keys(interfaces).forEach((nic) => {
    clientAddresses.push(ip.address(nic, 'ipv4'));
    clientAddresses.push(ip.address(nic, 'ipv6'));
  });
  clientSocket.on('listening', () => {
    const port = clientSocket.address().port;
    res.blue('Run Clint: Addresses [').ln();
    clientAddresses.forEach((ip) => {
      if (!ip) return;
      res.blue(`  [${ip}]:${port},`).ln();
    });
    res.blue(']').ln().ln();
  });

  // STUNサーバーからレスポンスが返ってきた際のハンドラ
  client.on('response', (packet) => {
    console.log('Received STUN:', packet);
    let natAddress = null;
    if (packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS]) {
      natAddress = packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS];
    } else {
      natAddress = packet.attrs[stun.attribute.MAPPED_ADDRESS];
    }
    res.ln().blue(`Received NAT: Address [${natAddress.address}]:${natAddress.port}`).ln();
    res.prompt();
  });

  // 他端末からUDPによるメッセージを受信した際のハンドラ
  client.on('message', (msg, rinfo) => {
    res.blue(`Received UDP message: ${msg.toString()} from [${rinfo.address}]:${rinfo.port}`).ln();
    res.prompt();
  });

  // STUNサーバーにリクエスト送信
  client.request(() => {
    res.green('Sending STUN packet').ln().ln();
  });
});

/**
 * 他端末へUDPへメッセージを送信します。
 * コマンド例: send 32.1.5.26 9011
 */
app.cmd('send :address :port :msg', '\tSend message', (req, res, next) => {
  const destHost = req.params.address;
  const destPort = parseInt(req.params.port);
  const destMsg = req.params.msg;

  const msg = new Buffer(destMsg);
  client.send(msg, 0, msg.length, destPort, destHost);
  res.prompt();
});