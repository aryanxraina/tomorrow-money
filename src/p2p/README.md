# Shared-house bill ledger (peer-to-peer)

Housemates split bills with no server and no account. Each device holds its own copy, and they sync directly when they can reach each other. Bills added offline merge when they reconnect.

Built on Pears modules, running in Node:

| Module | Job here |
| --- | --- |
| Hyperswarm | Finds housemates by a topic derived from the house key, and connects them with encrypted connections |
| Corestore / Hypercore | Each housemate's signed, append-only log of bills |
| Autobase | Merges everyone's logs into one agreed order, even after time apart |

Balances follow the app's main rule: **numbers by code**. They are a pure function of the agreed bills, in whole pence, so every peer gets the same answer. No AI is involved.

## Run it

```bash
cd src/p2p
npm install
npm test        # real peers on a local DHT, no internet needed
npm run demo    # two housemates in two processes; open the two links side by side
```

`npm run demo` starts a local DHT, so it works with Wi-Fi off. The bills and names are samples, and it starts fresh on every run.

Then try:

1. Add a bill on Ana's page. It appears on Ben's page.
2. Press "Go offline" on both, and add a different bill on each.
3. Press "Reconnect" on both. They agree, to the penny.

From the app root, `node scripts/smoke-p2p.mjs` runs those same steps in two browser pages.

## Between two real devices

Leave out `--bootstrap` to use the public DHT:

```bash
# First housemate. This prints the house key.
node peer.mjs --name Ana --house Ana,Ben --dir ./.house-ana

# Second housemate. This prints a writer key to pass to the first.
node peer.mjs --name Ben --house Ana,Ben --dir ./.house-ben --join HOUSE_KEY --port 4102

# First housemate, to let Ben write:
curl -X POST http://127.0.0.1:4101/invite -H "Content-Type: application/json" -d "{\"writerKey\":\"WRITER_KEY\"}"
```

## What this is and isn't

- **It is** a working example of the data layer, tested with real peers and real encrypted connections.
- **It isn't** part of the main app's screens yet, and isn't packaged as a Pear app. It runs on Node with Pears modules, not on the Pear runtime.
- **Not yet safe for real use:**
  - Anyone holding the house key can read the bills, and stored data isn't encrypted on disk. Autobase has an encryption option that this example doesn't use.
  - Any housemate who can write can add a bill naming anyone, and can invite others. There is no approval step or way to remove someone.
  - Housemates are a fixed list given at start-up.
  - The invite is a manual key swap.
- **Tested on one machine:** two processes, on a local DHT. It has not been run across two separate devices.

## Next steps

1. Package with the Pear runtime and call `@qvac/sdk` directly instead of over HTTP.
2. Pair housemates with a QR code or invite link.
3. Encrypt the base, and add an approval step for bills.
4. Add a community price board: receipts share prices with nearby peers, with no central server.
