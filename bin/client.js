const dgram = require('dgram');
const stun = require('stun');
const shell = require('shell');
const ip = require('ip');
const os = require('os');
const app = new shell({ chdir: __dirname })

let client = null;

// Configure the shell environment
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

// Run client command
app.cmd('run :port', '\tRun client', (req, res, next) => {
  // STUN Server (by Google)
  const stunPort = 19302;
  const stunHost = 'stun.l.google.com';

  // STUN Client
  client = stun.connect(stunPort, stunHost);
  client.on('error', (err) => {
    res.red('Error:', err);
    res.prompt();
  });
  const clientSocket = client._socket;
  const clientPort = parseInt(req.params.port);
  if (clientPort) {
    clientSocket.bind(clientPort);
  }

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

  // Client: STUN Response event handler
  client.on('response', (packet) => {
    console.log('Received STUN:', packet);
    // Save NAT Address
    let natAddress = null;
    if (packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS]) {
      natAddress = packet.attrs[stun.attribute.XOR_MAPPED_ADDRESS];
    } else {
      natAddress = packet.attrs[stun.attribute.MAPPED_ADDRESS];
    }
    res.ln().blue(`Received NAT: Address [${natAddress.address}]:${natAddress.port}`).ln();
    res.prompt();
  });

  // Client: UDP Message event handler
  client.on('message', (msg, rinfo) => {
    // res.blue('Received UDP message:', msg.toString(), 'from', rinfo.address).ln();
    res.blue(`Received UDP message: ${msg.toString()} from [${rinfo.address}]:${rinfo.port}`).ln();
    res.prompt();
  });

  // Sending STUN request
  client.request(() => {
    res.green('Sending STUN packet').ln().ln();
  });
});

// Send message command
app.cmd('send :address :port :msg', '\tSend message', (req, res, next) => {
  const destHost = req.params.address;
  const destPort = parseInt(req.params.port);
  const destMsg = req.params.msg;

  const msg = new Buffer(destMsg);
  client.send(msg, 0, msg.length, destPort, destHost);
  res.prompt();
});