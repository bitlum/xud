import { Arguments, Argv } from 'yargs';
import { DepositRequest } from '../../proto/xudrpc_pb';
import { callback, loadXudClient } from '../command';

export const command = 'deposit <currency>';

export const describe = 'gets an address to deposit funds to xud';

export const builder = (argv: Argv) => argv
  .positional('currency', {
    description: 'the ticker symbol of the currency to deposit.',
    type: 'string',
  })
  .example('$0 deposit BTC', 'get a BTC deposit address');

export const handler = async (argv: Arguments<any>) => {
  const request = new DepositRequest();
  request.setCurrency(argv.currency);
  (await loadXudClient(argv)).deposit(request, callback(argv));
};
