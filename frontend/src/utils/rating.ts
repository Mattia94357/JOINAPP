export const hasRealRating = (rating?: number, reviewCount?: number) => Boolean(
  typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5
  && typeof reviewCount === 'number' && reviewCount > 0,
);

export const ratingLabel = (rating?: number, reviewCount?: number) => hasRealRating(rating, reviewCount)
  ? rating!.toFixed(1)
  : 'No reviews yet';
