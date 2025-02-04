
// tslint:disable: max-line-length
import ConnextClient from '../../lib/connextclient/ConnextClient';
import { UnitConverter } from '../../lib/utils/UnitConverter';
import Logger from '../../lib/Logger';
import { SwapClientType } from '../../lib/constants/enums';
import { CurrencyInstance } from '../../lib/db/types';
import { PaymentState } from '../../lib/swaps/SwapClient';
import errors from '../../lib/connextclient/errors';

const MOCK_TX_HASH = '0x5544332211';
jest.mock('../../lib/utils/utils', () => {
  return {
    parseResponseBody: () => {
      return { txhash: MOCK_TX_HASH };
    },
  };
});
jest.mock('../../lib/Logger');
const mockedLogger = <jest.Mock<Logger>>(<any>Logger);

jest.mock('http', () => {
  return {
    request: jest.fn().mockImplementation((options, cb) => {
      if (options.path === '/deposit') {
        cb({
          statusCode: 404,
        });
      }
      return {
        write: jest.fn(),
        on: jest.fn(),
        end: jest.fn(),
      };
    }),
  };
});

const ETH_ASSET_ID = '0x0000000000000000000000000000000000000000';
const USDT_ASSET_ID = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const XUC_ASSET_ID = '0x9999999999999999999999999999999999999999';

describe('ConnextClient', () => {
  let connext: ConnextClient;

  beforeEach(() => {
    const config = {
      disable: false,
      host: 'http://tester',
      port: 1337,
      webhookhost: 'http://testerson',
      webhookport: 7331,
    };
    const logger = new mockedLogger();
    logger.trace = jest.fn();
    logger.error = jest.fn();
    logger.debug = jest.fn();
    const currencyInstances = [
      {
        id: 'ETH',
        tokenAddress: ETH_ASSET_ID,
        swapClient: SwapClientType.Connext,
      },
      {
        id: 'USDT',
        tokenAddress: USDT_ASSET_ID,
        swapClient: SwapClientType.Connext,
      },
      {
        id: 'XUC',
        tokenAddress: XUC_ASSET_ID,
        swapClient: SwapClientType.Connext,
      },
    ] as CurrencyInstance[];
    connext = new ConnextClient({
      config,
      currencyInstances,
      logger,
      unitConverter: new UnitConverter(),
    });
  });

  describe('withdraw', () => {
    const MOCK_FREE_BALANCE_ON_CHAIN = 10000;
    const DESTINATION_ADDRESS = '0x12345';

    beforeEach(() => {
      connext['getBalance'] = jest.fn().mockReturnValue({
        freeBalanceOnChain: MOCK_FREE_BALANCE_ON_CHAIN,
      });
      connext['sendRequest'] = jest.fn();
    });

    afterEach(() => {
      jest.clearAllMocks();
    }),

    it('fails with custom fee', async () => {
      expect.assertions(1);
      try {
        await connext.withdraw({
          currency: 'ETH',
          destination: DESTINATION_ADDRESS,
          amount: 123,
          fee: 1,
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });

    it('fails to withdraw all ETH', async () => {
      expect.assertions(1);
      try {
        await connext.withdraw({
          currency: 'ETH',
          destination: DESTINATION_ADDRESS,
          all: true,
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });

    it('fails when amount bigger than wallet balance', async () => {
      expect.assertions(1);
      try {
        await connext.withdraw({
          currency: 'ETH',
          destination: DESTINATION_ADDRESS,
          amount: 0.0000011,
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });

    it('withdraws all USDT', async () => {
      expect.assertions(3);
      const txhash = await connext.withdraw({
        currency: 'USDT',
        destination: DESTINATION_ADDRESS,
        all: true,
      });
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/onchain-transfer',
        'POST',
        expect.objectContaining({
          assetId: USDT_ASSET_ID,
          amount: MOCK_FREE_BALANCE_ON_CHAIN,
          recipient: DESTINATION_ADDRESS,
        }),
      );
      expect(txhash).toEqual(MOCK_TX_HASH);
    });

    it('withdraws 5000 USDT amount', async () => {
      expect.assertions(3);
      const txhash = await connext.withdraw({
        currency: 'USDT',
        destination: DESTINATION_ADDRESS,
        amount: 5000,
      });
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/onchain-transfer',
        'POST',
        expect.objectContaining({
          assetId: USDT_ASSET_ID,
          amount: '50',
          recipient: DESTINATION_ADDRESS,
        }),
      );
      expect(txhash).toEqual(MOCK_TX_HASH);
    });

    it('withdraws 0.000001 ETH amount', async () => {
      expect.assertions(3);
      const txhash = await connext.withdraw({
        currency: 'ETH',
        destination: DESTINATION_ADDRESS,
        amount: 0.0000005,
      });
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/onchain-transfer',
        'POST',
        expect.objectContaining({
          assetId: ETH_ASSET_ID,
          amount: '5000',
          recipient: DESTINATION_ADDRESS,
        }),
      );
      expect(txhash).toEqual(MOCK_TX_HASH);
    });
  });

  describe('sendRequest', () => {
    it('deposit fails with 404', async () => {
      expect.assertions(1);
      try {
        await connext['sendRequest']('/deposit', 'POST', {
          assetId: ETH_ASSET_ID,
          amount: BigInt('100000').toString(),
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe('lookupPayment', () => {
    it('returns PaymentState.Pending', async () => {
      expect.assertions(1);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({ status: 'PENDING' });
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(result).toEqual({ state: PaymentState.Pending });
    });

    it('returns PaymentState.Completed with preimage', async () => {
      expect.assertions(1);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({ status: 'COMPLETED', preImage: '0x1337' });
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(result).toEqual({ state: PaymentState.Succeeded, preimage: '1337' });
    });

    it('returns PaymentState.Failed when rejected app install for payment without status field', async () => {
      expect.assertions(3);
      const senderAppIdentityHash = '12345';
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({
          senderAppIdentityHash,
        });
      connext['sendRequest'] = jest.fn().mockReturnValue(Promise.resolve());
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/reject-install',
        'POST',
        expect.objectContaining({ appIdentityHash: senderAppIdentityHash }),
      );
      expect(result).toEqual({ state: PaymentState.Failed });
    });

    it('returns PaymentState.Pending when failing to reject app install for payment without status field', async () => {
      expect.assertions(3);
      const senderAppIdentityHash = '12345';
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({
          senderAppIdentityHash,
        });
      connext['sendRequest'] = jest.fn().mockReturnValue(Promise.reject());
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/reject-install',
        'POST',
        expect.objectContaining({ appIdentityHash: senderAppIdentityHash }),
      );
      expect(result).toEqual({ state: PaymentState.Pending });
    });

    it('returns PaymentState.Failed when EXPIRED', async () => {
      expect.assertions(3);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({ status: 'EXPIRED' });
      connext['sendRequest'] = jest.fn().mockReturnValue(Promise.resolve());
      const hash = '8f28fb27a164ae992fb4808b11c137d06e8e7d9304043a6b7163323f7cf53920';
      const currency = 'ETH';
      const result = await connext['lookupPayment'](hash, currency);
      expect(result).toEqual({ state: PaymentState.Failed });
      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/hashlock-resolve',
        'POST',
        expect.objectContaining({
          assetId: ETH_ASSET_ID,
          preImage: '0x',
          paymentId: '0xb2c0648834d105f3b372c6a05d11b0f19d88a8909f6315c8535e383e59991f8e',
        }),
      );
    });

    it('returns PaymentState.Failed when FAILED', async () => {
      expect.assertions(1);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockReturnValue({ status: 'FAILED' });
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(result).toEqual({ state: PaymentState.Failed });
    });

    it('returns PaymentState.Pending when error is unknown', async () => {
      expect.assertions(1);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('unknown error');
        });
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(result).toEqual({ state: PaymentState.Pending });
    });

    it('returns PaymentState.Failed when error is PAYMENT_NOT_FOUND', async () => {
      expect.assertions(1);
      connext['getHashLockStatus'] = jest
        .fn()
        .mockImplementation(() => {
          throw errors.PAYMENT_NOT_FOUND;
        });
      const result = await connext['lookupPayment']('0x12345', 'ETH');
      expect(result).toEqual({ state: PaymentState.Failed });
    });
  });

  describe('setReservedInboundAmount', () => {
    const amount = 50000000;
    const currency = 'ETH';

    beforeEach(() => {
      connext['sendRequest'] = jest.fn().mockResolvedValue(undefined);
    });

    it('requests collateral plus 3% buffer when we have none', async () => {
      connext['inboundAmounts'].set('ETH', 0);
      connext.setReservedInboundAmount(amount, currency);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: ETH_ASSET_ID, amount: (amount * 1.03 * 10 ** 10).toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('requests collateral plus 3% buffer when we have some collateral already', async () => {
      connext['inboundAmounts'].set('ETH', amount * 0.5);
      connext.setReservedInboundAmount(amount, currency);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: ETH_ASSET_ID, amount: (amount * 1.03 * 10 ** 10).toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('does not request collateral when we have more than enough to cover the reserved inbound amount', async () => {
      connext['inboundAmounts'].set('ETH', amount * 2);
      connext.setReservedInboundAmount(amount, currency);
      expect(connext['sendRequest']).toHaveBeenCalledTimes(0);
    });
  });

  describe('checkInboundCapacity', () => {
    const quantity = 20000000;
    const smallQuantity = 100;
    beforeEach(() => {
      connext['sendRequest'] = jest.fn().mockResolvedValue(undefined);
      connext['inboundAmounts'].set('ETH', 0);
    });

    it('requests collateral plus 5% buffer when there is none', async () => {
      expect(() => connext.checkInboundCapacity(quantity, 'ETH')).toThrowError('channel collateralization in progress, please try again in ~1 minute');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: ETH_ASSET_ID, amount: (quantity * 1.05 * 10 ** 10).toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('does not request collateral when there is a pending request', async () => {
      connext['requestCollateralPromises'].set('ETH', Promise.resolve());
      expect(() => connext.checkInboundCapacity(quantity, 'ETH')).toThrowError('channel collateralization in progress, please try again in ~1 minute');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(0);
    });

    it('requests the full collateral amount even when there is some existing collateral', async () => {
      const partialCollateral = 5000;
      connext['inboundAmounts'].set('ETH', partialCollateral);

      expect(() => connext.checkInboundCapacity(quantity, 'ETH')).toThrowError('channel collateralization in progress, please try again in ~1 minute');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: ETH_ASSET_ID, amount: (quantity * 1.05 * 10 ** 10).toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('requests the hardcoded minimum if the collateral shortage is below it', async () => {
      const minCollateralRequestUnits = ConnextClient['MIN_COLLATERAL_REQUEST_SIZES']['ETH']! * 10 ** 10;

      expect(() => connext.checkInboundCapacity(smallQuantity, 'ETH')).toThrowError('channel collateralization in progress, please try again in ~1 minute');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: ETH_ASSET_ID, amount: minCollateralRequestUnits.toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('requests collateral plus 5% buffer for a small shortage when there is no hardcoded minimum for the currency', async () => {
      expect(() => connext.checkInboundCapacity(smallQuantity, 'XUC')).toThrowError('channel collateralization in progress, please try again in ~1 minute');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(1);
      expect(connext['sendRequest']).toHaveBeenCalledWith(
        '/request-collateral',
        'POST',
        expect.objectContaining({ assetId: XUC_ASSET_ID, amount: (smallQuantity * 1.05 * 10 ** 10).toLocaleString('fullwide', { useGrouping: false }) }),
      );
    });

    it('does not request collateral or throw when there is sufficient collateral', async () => {
      connext['inboundAmounts'].set('ETH', quantity);
      connext.checkInboundCapacity(quantity, 'ETH');

      expect(connext['sendRequest']).toHaveBeenCalledTimes(0);
    });
  });
});
