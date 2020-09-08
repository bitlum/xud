import { Arguments, Argv } from 'yargs';
import { AddPairRequest } from '../../proto/xudrpc_pb';
import { callback, loadXudClient } from '../command';
import { argChecks } from '../utils';

export const command = 'addpair <pair_id|base_currency> [quote_currency]';

export const describe = 'add a trading pair';

export const builder = (argv: Argv) => argv
  .positional('pair_id', {
    description: 'the pair ticker id or base currency',
    type: 'string',
  })
  .positional('quote_currency', {
    description: 'the currency used to quote a price',
    type: 'string',
  })
  .example('$0 addpair LTC/BTC', 'add the LTC/BTC trading pair by ticker id')
  .example('$0 addpair LTC BTC', 'add the LTC/BTC trading pair by currencies');

export const handler = async (argv: Arguments<any>) => {
  const request = new AddPairRequest();
  let baseCurrency: string;
  let quoteCurrency: string;
  if (argv.base_currency && argv.quote_currency) {
    baseCurrency = argv.base_currency;
    quoteCurrency = argv.quote_currency;
  } else {
    argChecks.PAIR_ID_CHECK({ pairId: argv.pair_id });
    [baseCurrency, quoteCurrency] = argv.pair_id.split('/');
  }
  request.setBaseCurrency(baseCurrency.toUpperCase());
  request.setQuoteCurrency(quoteCurrency.toUpperCase());
  (await loadXudClient(argv)).addPair(request, callback(argv));
};
