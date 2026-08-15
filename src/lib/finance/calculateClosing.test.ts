import { describe, expect, it } from 'vitest'
import { calculateClosing } from './calculateClosing'

describe('calculateClosing', () => {
  it('calcula comissão percentual sobre líquido dos canais', () => {
    const result = calculateClosing({
      grossRevenue: 10000,
      platformFees: 1500,
      discounts: 500,
      ownerExpenses: 900,
      feeType: 'percentage',
      feeValue: 20,
      feeBase: 'net_channels',
      emergencyReserve: 300,
    })

    expect(result.managementFee).toBe(1600)
    expect(result.ownerNet).toBe(5200)
  })

  it('calcula comissão percentual sobre receita bruta', () => {
    const result = calculateClosing({
      grossRevenue: 10000,
      platformFees: 1000,
      discounts: 0,
      ownerExpenses: 500,
      feeType: 'percentage',
      feeValue: 15,
      feeBase: 'gross',
      emergencyReserve: 0,
    })

    expect(result.managementFee).toBe(1500)
    expect(result.ownerNet).toBe(7000)
  })

  it('aceita comissão fixa', () => {
    const result = calculateClosing({
      grossRevenue: 3000,
      platformFees: 300,
      discounts: 100,
      ownerExpenses: 200,
      feeType: 'fixed',
      feeValue: 450,
      feeBase: 'net_channels',
      emergencyReserve: 50,
    })

    expect(result.managementFee).toBe(450)
    expect(result.ownerNet).toBe(1900)
  })
})
