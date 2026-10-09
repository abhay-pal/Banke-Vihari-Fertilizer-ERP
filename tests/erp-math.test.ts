import { describe, expect, it } from 'vitest'
import { paymentBalance, saleTotals, weightedAverageCost } from '../src/lib/utils'

describe('ERP retail math', () => {
  it('calculates sale subtotal, discount, GST and total separately', () => {
    const totals = saleTotals([
      { quantity: 2, rate: 100, discount: 10, gstRate: 5 },
      { quantity: 1, rate: 250, discount: 0, gstRate: 0 },
    ])
    expect(totals.subtotal).toBe(450)
    expect(totals.discount).toBe(10)
    expect(totals.taxable).toBe(440)
    expect(totals.tax).toBe(9.5)
    expect(totals.total).toBe(449.5)
  })

  it('keeps GST out of the taxable amount after line discount', () => {
    const totals = saleTotals([{ quantity: 1, rate: 1000, discount: 100, gstRate: 18 }])
    expect(totals.taxable).toBe(900)
    expect(totals.tax).toBe(162)
    expect(totals.total).toBe(1062)
  })

  it('records a split cash/UPI payment and leaves the exact credit balance', () => {
    const result = paymentBalance(5000, 1200 + 800)
    expect(result).toEqual({ total: 5000, paid: 2000, due: 3000, overpaid: false })
  })

  it('rejects payment totals above the bill', () => {
    expect(paymentBalance(500, 500.01).overpaid).toBe(true)
  })

  it('uses quantity-weighted average inventory cost, excluding zero stock', () => {
    expect(weightedAverageCost(10, 100, 10, 140)).toBe(120)
    expect(weightedAverageCost(0, 120, 5, 140)).toBe(140)
    expect(weightedAverageCost(0, 0, 0, 0)).toBe(0)
  })
})
