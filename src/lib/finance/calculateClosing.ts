export type FeeType = 'percentage' | 'fixed'
export type FeeBase = 'gross' | 'net_channels'

export type ClosingInput = {
  grossRevenue: number
  platformFees: number
  discounts: number
  ownerExpenses: number
  feeType: FeeType
  feeValue: number
  feeBase: FeeBase
  emergencyReserve: number
}

export type ClosingResult = {
  managementFee: number
  ownerNet: number
}

function money(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100
}

export function calculateClosing(input: ClosingInput): ClosingResult {
  const gross = Math.max(0, input.grossRevenue)
  const platform = Math.max(0, input.platformFees)
  const discounts = Math.max(0, input.discounts)
  const expenses = Math.max(0, input.ownerExpenses)
  const reserve = Math.max(0, input.emergencyReserve)
  const feeValue = Math.max(0, input.feeValue)

  const percentageBase = input.feeBase === 'gross'
    ? gross
    : Math.max(0, gross - platform - discounts)

  const managementFee = input.feeType === 'fixed'
    ? feeValue
    : percentageBase * feeValue / 100

  return {
    managementFee: money(managementFee),
    ownerNet: money(gross - platform - discounts - expenses - managementFee - reserve),
  }
}
