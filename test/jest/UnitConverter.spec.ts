import { UnitConverter } from '../../lib/utils/UnitConverter';
import { Currency } from '../../lib/orderbook/types';

describe('UnitConverter', () => {
  const currencies: Currency[] = [
    { id: 'BTC', decimalPlaces: 8, swapClient: 0 },
    { id: 'ETH', decimalPlaces: 18, swapClient: 0 },
  ];
  const unitConverter = new UnitConverter(currencies);

  describe('amountToUnits', () => {

    test('converts BTC amount to units', () => {
      const amount = 99999999;
      expect(unitConverter.
        amountToUnits({
          amount,
          currency: 'BTC',
        },
      )).toEqual(amount);
    });

    test('converts ETH amount to units', () => {
      expect(unitConverter.
        amountToUnits({
          amount: 7500000,
          currency: 'ETH',
        },
      )).toEqual(75000000000000000);
    });

    test('throws error upon unknown currency', () => {
      expect.assertions(1);
      try {
        unitConverter.amountToUnits({
          amount: 123,
          currency: 'ABC',
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });

  });

  describe('unitsToAmount', () => {

    test('converts BTC units to amount', () => {
      const units = 99999999n;
      expect(unitConverter.
        unitsToAmount({
          units,
          currency: 'BTC',
        },
      )).toEqual(units);
    });

    test('converts ETH units to amount', () => {
      expect(unitConverter.
        unitsToAmount({
          units: 75000000000000000n,
          currency: 'ETH',
        },
      )).toEqual(7500000);
    });

    test('throws error upon unknown currency', () => {
      expect.assertions(1);
      try {
        unitConverter.unitsToAmount({
          units: 123n,
          currency: 'ABC',
        });
      } catch (e) {
        expect(e).toMatchSnapshot();
      }
    });

  });
});
