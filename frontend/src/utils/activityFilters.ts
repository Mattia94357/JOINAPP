import type { ActivityResponse } from '../api';

export type ExploreSort = 'soonest' | 'nearest' | 'newest';
export type ExploreDateFilter = 'any' | 'today' | 'tomorrow' | 'weekend' | 'week';
export type ExploreTimeFilter = 'any' | 'morning' | 'afternoon' | 'evening' | 'night';
export type ActivityAgeGroup = 'any' | '18-24' | '25-34' | '35-44' | '45+';

export type ExploreFilters = {
  sortBy: ExploreSort;
  when: ExploreDateFilter;
  customDateEnabled: boolean;
  customStart: string;
  customEnd: string;
  time: ExploreTimeFilter;
  distanceKm: number | null;
  category: string;
  ageGroup: ActivityAgeGroup;
};

export type Coordinate = { latitude: number; longitude: number };

export const DEFAULT_EXPLORE_FILTERS: ExploreFilters = {
  sortBy: 'soonest',
  when: 'any',
  customDateEnabled: false,
  customStart: '',
  customEnd: '',
  time: 'any',
  distanceKm: null,
  category: 'All',
  ageGroup: 'any',
};

export const sortOptions = [
  { label: 'Soonest', value: 'soonest' as const },
  { label: 'Nearest', value: 'nearest' as const },
  { label: 'Newest', value: 'newest' as const },
];

export const dateOptions = [
  { label: 'Any date', value: 'any' as const },
  { label: 'Today', value: 'today' as const },
  { label: 'Tomorrow', value: 'tomorrow' as const },
  { label: 'This weekend', value: 'weekend' as const },
  { label: 'This week', value: 'week' as const },
];

export const timeOptions = [
  { label: 'Any time', value: 'any' as const },
  { label: 'Morning', value: 'morning' as const },
  { label: 'Afternoon', value: 'afternoon' as const },
  { label: 'Evening', value: 'evening' as const },
  { label: 'Night', value: 'night' as const },
];

export const distanceOptions = [
  { label: 'Any distance', value: null },
  { label: 'Within 2 km', value: 2 },
  { label: 'Within 5 km', value: 5 },
  { label: 'Within 10 km', value: 10 },
  { label: 'Within 25 km', value: 25 },
];

export const ageGroupOptions = [
  { label: 'Any age', value: 'any' as const },
  { label: '18–24', value: '18-24' as const },
  { label: '25–34', value: '25-34' as const },
  { label: '35–44', value: '35-44' as const },
  { label: '45+', value: '45+' as const },
];

const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export const parseLocalDateInput = (value: string, endOfDay = false) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return undefined;
  const parsed = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  return parsed.getFullYear() === Number(match[1])
    && parsed.getMonth() === Number(match[2]) - 1
    && parsed.getDate() === Number(match[3])
    ? parsed
    : undefined;
};

const timeParts = (value?: string) => {
  if (!value) return undefined;
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(value.trim());
  if (!match) return undefined;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  const period = match[3]?.toUpperCase();
  if (minute > 59 || hour > (period ? 12 : 23)) return undefined;
  if (period === 'AM') hour = hour === 12 ? 0 : hour;
  if (period === 'PM') hour = hour === 12 ? 12 : hour + 12;
  return { hour, minute };
};

export const combineLocalDateAndTime = (dateValue: string, timeValue: string) => {
  const date = parseLocalDateInput(dateValue);
  const time = timeParts(timeValue);
  if (!date || !time) return undefined;
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
};

const nextWeekday = (now: Date, weekday: number) => {
  const delta = (weekday - now.getDay() + 7) % 7;
  return addDays(now, delta);
};

export const activityStartDate = (activity: ActivityResponse, now = new Date()) => {
  if (activity.startsAt) {
    const parsed = new Date(activity.startsAt);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }

  const label = activity.date?.trim().toLowerCase();
  const time = timeParts(activity.time || activity.startTime) || { hour: 12, minute: 0 };
  let date: Date | undefined;
  if (label === 'today' || label === 'tonight') date = startOfLocalDay(now);
  else if (label === 'tomorrow') date = addDays(now, 1);
  else {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = weekdays.indexOf(label || '');
    if (weekday >= 0) date = nextWeekday(now, weekday);
  }
  if (!date) return undefined;
  date.setHours(time.hour, time.minute, 0, 0);
  return date;
};

export const distanceBetweenKm = (from: Coordinate, to: Coordinate) => {
  const radiusKm = 6371;
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const firstLatitude = radians(from.latitude);
  const secondLatitude = radians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export const activityDistanceKm = (activity: ActivityResponse, userCoordinate?: Coordinate | null) => {
  if (!userCoordinate || !Number.isFinite(activity.latitude) || !Number.isFinite(activity.longitude)) return undefined;
  return distanceBetweenKm(userCoordinate, {
    latitude: activity.latitude as number,
    longitude: activity.longitude as number,
  });
};

export const formatDistance = (distanceKm?: number) => {
  if (distanceKm === undefined) return undefined;
  return distanceKm < 1 ? `${Math.round(distanceKm * 1000)} m` : `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
};

const dateBounds = (filters: ExploreFilters, now: Date) => {
  const today = startOfLocalDay(now);
  if (filters.customDateEnabled) {
    const start = parseLocalDateInput(filters.customStart);
    const end = parseLocalDateInput(filters.customEnd || filters.customStart, true);
    return start && end ? { start, end } : undefined;
  }
  if (filters.when === 'today') return { start: today, end: addDays(today, 1) };
  if (filters.when === 'tomorrow') return { start: addDays(today, 1), end: addDays(today, 2) };
  if (filters.when === 'weekend') {
    const saturday = today.getDay() === 0 ? addDays(today, -1) : nextWeekday(today, 6);
    return { start: saturday, end: addDays(saturday, 2) };
  }
  if (filters.when === 'week') {
    const daysUntilNextMonday = ((8 - today.getDay()) % 7) || 7;
    return { start: today, end: addDays(today, daysUntilNextMonday) };
  }
  return undefined;
};

const matchesTime = (date: Date, filter: ExploreTimeFilter) => {
  const hour = date.getHours();
  if (filter === 'morning') return hour >= 5 && hour < 12;
  if (filter === 'afternoon') return hour >= 12 && hour < 17;
  if (filter === 'evening') return hour >= 17 && hour < 21;
  if (filter === 'night') return hour >= 21 || hour < 5;
  return true;
};

const soonestComparison = (first: ActivityResponse, second: ActivityResponse, now: Date) => {
  const firstDate = activityStartDate(first, now)?.getTime();
  const secondDate = activityStartDate(second, now)?.getTime();
  const rank = (value?: number) => value === undefined ? 2 : value >= now.getTime() ? 0 : 1;
  const rankDelta = rank(firstDate) - rank(secondDate);
  if (rankDelta) return rankDelta;
  if (firstDate === undefined || secondDate === undefined) return 0;
  return rank(firstDate) === 1 ? secondDate - firstDate : firstDate - secondDate;
};

export const filterAndSortActivities = (
  activities: ActivityResponse[],
  filters: ExploreFilters,
  userCoordinate?: Coordinate | null,
  now = new Date(),
) => {
  const bounds = dateBounds(filters, now);
  const distances = new Map(activities.map((activity) => [activity.id, activityDistanceKm(activity, userCoordinate)]));
  const filtered = activities.filter((activity) => {
    if (activity.status === 'cancelled' || activity.status === 'completed') return false;
    const start = activityStartDate(activity, now);
    if (!start || start.getTime() <= now.getTime()) return false;
    if (filters.category !== 'All' && activity.category !== filters.category) return false;
    if (filters.ageGroup !== 'any' && activity.ageGroup !== filters.ageGroup) return false;
    if (bounds && (!start || start < bounds.start || start >= bounds.end)) return false;
    if (filters.time !== 'any' && (!start || !matchesTime(start, filters.time))) return false;
    if (filters.distanceKm !== null) {
      const distance = distances.get(activity.id);
      if (distance === undefined || distance > filters.distanceKm) return false;
    }
    return true;
  });

  return [...filtered].sort((first, second) => {
    if (filters.sortBy === 'newest') {
      return (new Date(second.createdAt || 0).getTime() || 0) - (new Date(first.createdAt || 0).getTime() || 0);
    }
    if (filters.sortBy === 'nearest' && userCoordinate) {
      const firstDistance = distances.get(first.id) ?? Number.POSITIVE_INFINITY;
      const secondDistance = distances.get(second.id) ?? Number.POSITIVE_INFINITY;
      return firstDistance - secondDistance || soonestComparison(first, second, now);
    }
    return soonestComparison(first, second, now);
  });
};

export const activeExploreFilterCount = (filters: ExploreFilters) => [
  filters.customDateEnabled || filters.when !== 'any',
  filters.time !== 'any',
  filters.distanceKm !== null,
  filters.category !== 'All',
  filters.ageGroup !== 'any',
].filter(Boolean).length;
