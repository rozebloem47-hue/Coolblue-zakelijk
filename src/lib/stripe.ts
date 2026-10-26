import { createServerFn } from '@tanstack/react-start'
import { IMPORTED_ID_OFFSET, fromCatalogRow, isImportedId, type CatalogRow } from '@/data/imported-products'

export const getStripeEnabled = createServerFn({ method: 'GET' }).handler(
  () => !!process.env.STRIPE_SECRET_KEY
)

export const createCheckoutSession = createServerFn({
  method: 'POST',
})
  .inputValidator((productId: number) => productId)
  .handler(async ({ data: productId }) => {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('Stripe is not configured')
    }
    const { default: Stripe } = await import('stripe')
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

    // Het assortiment staat in de database; alleen actieve producten zijn te koop.
    if (!isImportedId(productId)) {
      throw new Error('Product not found')
    }
    const [{ db }, { catalogProducts }, { and, eq }] = await Promise.all([
      import('../../db/index'),
      import('../../db/schema'),
      import('drizzle-orm'),
    ])
    const [row] = await db
      .select()
      .from(catalogProducts)
      .where(and(eq(catalogProducts.id, productId - IMPORTED_ID_OFFSET), eq(catalogProducts.active, true)))
    const product = row ? fromCatalogRow(row as CatalogRow) : undefined
    if (!product) {
      throw new Error('Product not found')
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: {
              name: product.name,
              description: product.description,
            },
            unit_amount: Math.round(product.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL ?? 'http://localhost:3000'}/checkout/success`,
      cancel_url: `${process.env.SITE_URL ?? 'http://localhost:3000'}/checkout/cancel`,
    })

    return session.url
  })
