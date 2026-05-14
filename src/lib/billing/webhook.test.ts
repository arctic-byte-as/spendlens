import { handleStripeWebhookEvent } from './webhook'

describe('handleStripeWebhookEvent', () => {
  it('updates profile on checkout.session.completed', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ update }))

    await handleStripeWebhookEvent(
      { from },
      {
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_123',
            client_reference_id: 'user-1',
          },
        },
      } as never
    )

    expect(from).toHaveBeenCalledWith('profiles')
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        stripe_customer_id: 'cus_123',
        subscription_status: 'active',
        subscription_tier: 'pro',
      })
    )
    expect(eq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('marks invoice.payment_failed as past_due', async () => {
    const eq = jest.fn().mockResolvedValue({ error: null })
    const update = jest.fn(() => ({ eq }))
    const from = jest.fn(() => ({ update }))

    await handleStripeWebhookEvent(
      { from },
      {
        type: 'invoice.payment_failed',
        data: {
          object: {
            customer: 'cus_123',
          },
        },
      } as never
    )

    expect(eq).toHaveBeenCalledWith('stripe_customer_id', 'cus_123')
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ subscription_status: 'past_due' }))
  })
})
