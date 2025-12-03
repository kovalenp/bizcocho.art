type BookingPriceDisplayProps = {
  totalPriceCents: number
  discountedPriceCents: number
  numberOfPeople: number
  pricePerPersonCents: number
  hasDiscount: boolean
}

/**
 * Pure component for displaying booking price with optional discount.
 */
export function BookingPriceDisplay({
  totalPriceCents,
  discountedPriceCents,
  numberOfPeople,
  pricePerPersonCents,
  hasDiscount,
}: BookingPriceDisplayProps) {
  const totalPrice = totalPriceCents / 100
  const discountedPrice = discountedPriceCents / 100
  const pricePerPerson = pricePerPersonCents / 100

  return (
    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-sm text-gray-600 mb-1">Total Price</div>
          {hasDiscount ? (
            <div>
              <div className="text-lg text-gray-400 line-through">
                €{totalPrice.toFixed(2)}
              </div>
              <div className="text-3xl font-bold text-primary">
                {discountedPriceCents === 0 ? 'FREE' : `€${discountedPrice.toFixed(2)}`}
              </div>
            </div>
          ) : (
            <div className="text-3xl font-bold text-primary">
              €{totalPrice.toFixed(2)}
            </div>
          )}
        </div>
        {numberOfPeople > 1 && !hasDiscount && (
          <div className="text-sm text-gray-500">
            €{pricePerPerson.toFixed(2)} × {numberOfPeople}
          </div>
        )}
      </div>
    </div>
  )
}
