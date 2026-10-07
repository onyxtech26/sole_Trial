import type { GuideReview } from '../types';

/** A guide's score: the average of their reviews, or the fallback while there are none. */
export const averageRating = (reviews: GuideReview[], fallback = 5): number => {
  if (!reviews.length) return fallback;
  const sum = reviews.reduce((n, r) => n + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
};
