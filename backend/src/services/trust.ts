export const reviewCount = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : 0;

export const hostRating = (user: { hostRating?: unknown; reviewCount?: unknown }) => {
  const count = reviewCount(user.reviewCount);
  const rating = user.hostRating;
  return count > 0 && typeof rating === 'number' && Number.isFinite(rating) && rating >= 0 && rating <= 5
    ? rating
    : undefined;
};
