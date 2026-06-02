export const availabilityOptions = ['All', 'Available now', 'Tonight', 'Tomorrow', 'This weekend'];

export const getAvailabilityTag = (date: string | undefined): string | undefined => {
  if (!date) return undefined;

  const eventDate = new Date(date);
  const now = new Date();
  
  // Reset time portion for comparisons
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const thisWeekend = new Date(today);
  thisWeekend.setDate(thisWeekend.getDate() + (6 - today.getDay()));

  const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());

  // Check if event is within the next 2 hours (Now)
  const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  if (eventDate >= now && eventDate <= twoHoursFromNow && eventDateOnly.getTime() === today.getTime()) {
    return 'Available now';
  }

  // Check if event is tonight (same day, after 6 PM)
  if (eventDateOnly.getTime() === today.getTime() && eventDate.getHours() >= 18) {
    return 'Tonight';
  }

  // Check if event is tomorrow
  if (eventDateOnly.getTime() === tomorrow.getTime()) {
    return 'Tomorrow';
  }

  // Check if event is this weekend (Saturday or Sunday)
  const eventDay = eventDateOnly.getDay();
  if ((eventDay === 5 || eventDay === 6) && eventDateOnly >= today && eventDateOnly <= thisWeekend) {
    return 'This weekend';
  }

  return undefined;
};
