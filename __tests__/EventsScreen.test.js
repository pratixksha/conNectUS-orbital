jest.mock('../lib/supabase');

import { countActive, applyFilters } from '../screens/EventsScreen';

const today = new Date();
const todayISO = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0).toISOString();

const thisWeekISO = (() => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + 1);
    d.setHours(12, 0, 0, 0);
    return d.toISOString();
})();

const thisMonthISO = new Date(today.getFullYear(), today.getMonth(), 5, 12, 0, 0).toISOString();

const futureMonthISO = new Date(today.getFullYear(), today.getMonth() + 2, 5, 12, 0, 0).toISOString();

const mockEvents = [
    { id: '1', title: 'Hackathon', category: 'Tech', location: 'COM1 Level 2', date: todayISO },
    { id: '2', title: 'Yoga Session', category: 'Wellness', location: 'MPSH', date: thisWeekISO },
    { id: '3', title: 'Art Show', category: 'Arts', location: 'UTown Green', date: thisMonthISO },
    { id: '4', title: 'Career Talk', category: 'Career', location: 'Engineering Auditorium', date: futureMonthISO },
    { id: '5', title: 'Study Group', category: 'Academic', location: 'Central Library', date: thisMonthISO },
];

describe('countActive', () => {
    test('returns 0 for default filters', () => {
        expect(countActive({ categories: [], dateRange: 'any', locations: [] })).toBe(0);
    });

    test('returns 1 when only category is set', () => {
        expect(countActive({ categories: ['Tech'], dateRange: 'any', locations: [] })).toBe(1);
    });

    test('returns 1 when only date is set', () => {
        expect(countActive({ categories: [], dateRange: 'today', locations: [] })).toBe(1);
    });

    test('returns 1 when only location is set', () => {
        expect(countActive({ categories: [], dateRange: 'any', locations: ['UTown'] })).toBe(1);
    });

    test('returns 3 when all filters are active', () => {
        expect(countActive({ categories: ['Tech'], dateRange: 'today', locations: ['UTown'] })).toBe(3);
    });

    test('returns 2 when category and location are set', () => {
        expect(countActive({ categories: ['Tech', 'Arts'], dateRange: 'any', locations: ['Computing'] })).toBe(2);
    });
});

describe('applyFilters - category', () => {
    test('returns all events when no category filter set', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: [] });
        expect(result).toHaveLength(5);
    });

    test('filters by a single category', () => {
        const result = applyFilters(mockEvents, { categories: ['Tech'], dateRange: 'any', locations: [] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Hackathon');
    });

    test('filters by multiple categories', () => {
        const result = applyFilters(mockEvents, { categories: ['Tech', 'Arts'], dateRange: 'any', locations: [] });
        expect(result).toHaveLength(2);
    });

    test('returns empty when category matches nothing', () => {
        const result = applyFilters(mockEvents, { categories: ['Community'], dateRange: 'any', locations: [] });
        expect(result).toHaveLength(0);
    });
});

describe('applyFilters - location', () => {
    test('filters by Computing (com1)', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['Computing'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Hackathon');
    });

    test('filters by UTown', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['UTown'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Art Show');
    });

    test('filters by Sports (mpsh)', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['Sports'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Yoga Session');
    });

    test('filters by Engineering', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['Engineering'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Career Talk');
    });

    test('Others catches locations not matching any known area', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['Others'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Study Group');
    });

    test('filters by multiple locations', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'any', locations: ['UTown', 'Computing'] });
        expect(result).toHaveLength(2);
    });
});

describe('applyFilters - date', () => {
    test('filters by today', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'today', locations: [] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Hackathon');
    });

    test('filters by this week', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'this_week', locations: [] });
        expect(result.length).toBeGreaterThanOrEqual(1);
        expect(result.some(e => e.title === 'Hackathon')).toBe(true);
    });

    test('filters by this month', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'this_month', locations: [] });
        expect(result.some(e => e.title === 'Art Show')).toBe(true);
        expect(result.some(e => e.title === 'Study Group')).toBe(true);
        expect(result.some(e => e.title === 'Career Talk')).toBe(false);
    });

    test('excludes future month events when filtering this month', () => {
        const result = applyFilters(mockEvents, { categories: [], dateRange: 'this_month', locations: [] });
        expect(result.some(e => e.title === 'Career Talk')).toBe(false);
    });
});

describe('applyFilters - combined', () => {
    test('combines category and location filters', () => {
        const result = applyFilters(mockEvents, { categories: ['Tech'], dateRange: 'any', locations: ['Computing'] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Hackathon');
    });

    test('combines category and date filters', () => {
        const result = applyFilters(mockEvents, { categories: ['Tech'], dateRange: 'today', locations: [] });
        expect(result).toHaveLength(1);
        expect(result[0].title).toBe('Hackathon');
    });

    test('returns empty when combined filters match nothing', () => {
        const result = applyFilters(mockEvents, { categories: ['Tech'], dateRange: 'any', locations: ['UTown'] });
        expect(result).toHaveLength(0);
    });

    test('returns empty array for empty events list', () => {
        const result = applyFilters([], { categories: ['Tech'], dateRange: 'today', locations: ['Computing'] });
        expect(result).toHaveLength(0);
    });
});