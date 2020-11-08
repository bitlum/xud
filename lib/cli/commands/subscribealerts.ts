import { ServiceError, status } from 'grpc';
import { Arguments } from 'yargs';
import { XudClient } from '../../proto/xudrpc_grpc_pb';
import * as xudrpc from '../../proto/xudrpc_pb';
import { setTimeoutPromise } from '../../utils/utils';
import { loadXudClient } from '../command';
import { AlertType } from '../../constants/enums';

export const command = 'subscribealerts';

export const describe = 'subscribe alerts such as low balance';

export const builder = {};

export const handler = async (argv: Arguments) => {
  await ensureConnection(argv, true);
};

let client: XudClient;

const ensureConnection = async (argv: Arguments, printError?: boolean) => {
  if (!client) {
    client = await loadXudClient(argv);
  }
  client.waitForReady(Date.now() + 3000, (error: Error | null) => {
    if (error) {
      if (error.message === 'Failed to connect before the deadline') {
        console.error(`could not connect to xud at ${argv.rpchost}:${argv.rpcport}, is xud running?`);
        process.exit(1);
      }

      if (printError) console.error(`${error.name}: ${error.message}`);
      setTimeout(ensureConnection.bind(undefined, argv, printError), 3000);
    } else {
      console.log('Successfully connected, subscribing for alerts');
      subscribeAlerts(argv);
    }
  });
};

const subscribeAlerts = (argv: Arguments<any>) => {
  const request = new xudrpc.SubscribeAlertsRequest();
  const alertsSubscription = client.subscribeAlerts(request);

  alertsSubscription.on('data', (alert: xudrpc.Alert) => {
    console.log(`${AlertType[alert.getType()]}: ${alert.getMessage()}`);
  });
  alertsSubscription.on('end', reconnect.bind(undefined, argv));
  alertsSubscription.on('error', async (err: ServiceError) => {
    if (err.code === status.UNIMPLEMENTED) {
      console.error("xud is locked, run 'xucli unlock', 'xucli create', or 'xucli restore' then try again");
      process.exit(1);
    }
    console.warn(`Unexpected error occured: ${err.message}, reconnecting in 1 second`);
    await setTimeoutPromise(1000);
    await ensureConnection(argv);
  });
};

const reconnect = async (argv: Arguments) => {
  console.log('Stream has closed, trying to reconnect');
  await ensureConnection(argv, false);
};
