import { Currency } from 'lib/orderbook/types';

class UnitConverter {
  private decimalPlacesPerCurrency = new Map<string, number>();

  constructor(currencies: Currency[]) {
    currencies.forEach((currency) => {
      this.decimalPlacesPerCurrency.set(currency.id, currency.decimalPlaces);
    });
  }

  public amountToUnits = (
    { currency, amount }:
    { currency: string, amount: number },
  ): bigint => {
    const decimalPlaces = this.decimalPlacesPerCurrency.get(currency);
    if (!decimalPlaces) {
      throw new Error(`cannot convert ${currency} amount of ${amount} to units because decimal places per currency was not found in the database`);
    }
    if (decimalPlaces < 8) {
      return BigInt(amount) / (10n ** (8n - BigInt(decimalPlaces)));
    } else if (decimalPlaces > 8n) {
      return BigInt(amount) * (10n ** BigInt(decimalPlaces) - 8n);
    } else {
      return BigInt(amount);
    }
  }

  public unitsToAmount = (
    { currency, units }:
    { currency: string, units: bigint },
  ): number => {
    const decimalPlaces = this.decimalPlacesPerCurrency.get(currency);
    if (!decimalPlaces) {
      throw new Error(`cannot convert ${currency} units of ${units} to units because decimal places per currency was not found in the database`);
    }
    if (decimalPlaces < 8) {
      return Number(units) * (10 ** (8 - decimalPlaces));
    } else if (decimalPlaces > 8n) {
      return Number(units) / (10 ** (decimalPlaces - 8));
    } else {
      return Number(units);
    }
  }
}

export { UnitConverter };
