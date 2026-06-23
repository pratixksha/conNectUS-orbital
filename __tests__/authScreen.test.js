/* Unit tests for AuthScreen.js pure logic functions.
 Imports the real functions directly from the screen file. */

jest.mock('../lib/supabase');

import { isNUSEmail, toggleInterest, validateStep1, validateStep2 } from '../screens/AuthScreen';

describe('isNUSEmail', () => {
  test('accepts @u.nus.edu email', () => {
    expect(isNUSEmail('e1234567@u.nus.edu')).toBe(true);
  });
  test('accepts @nus.edu.sg email', () => {
    expect(isNUSEmail('staff@nus.edu.sg')).toBe(true);
  });
  test('rejects gmail', () => {
    expect(isNUSEmail('user@gmail.com')).toBe(false);
  });
  test('rejects empty string', () => {
    expect(isNUSEmail('')).toBe(false);
  });
  test('rejects similar but wrong domain', () => {
    expect(isNUSEmail('user@nus.com')).toBe(false);
  });
  test('is case sensitive on domain match', () => {
    expect(isNUSEmail('user@U.NUS.EDU')).toBe(false);
  });
});

describe('toggleInterest', () => {
  test('adds interest if not already selected', () => {
    expect(toggleInterest(['Gaming'], 'Music')).toEqual(['Gaming', 'Music']);
  });
  test('removes interest if already selected', () => {
    expect(toggleInterest(['Gaming', 'Music'], 'Gaming')).toEqual(['Music']);
  });
  test('works correctly on an empty array', () => {
    expect(toggleInterest([], 'Gaming')).toEqual(['Gaming']);
  });
  test('does not mutate the original array', () => {
    const original = ['Gaming'];
    toggleInterest(original, 'Music');
    expect(original).toEqual(['Gaming']);
  });
});

describe('validateStep1 (signup credentials)', () => {
  const validInput = { email: 'e123@u.nus.edu', pw: 'password123', pw2: 'password123' };

  test('passes with valid input', () => {
    expect(validateStep1(validInput)).toEqual({ valid: true });
  });
  test('fails when email is missing', () => {
    expect(validateStep1({ ...validInput, email: '' })).toEqual({
      valid: false, reason: 'missing_fields',
    });
  });
  test('fails when email is not an NUS email', () => {
    expect(validateStep1({ ...validInput, email: 'user@gmail.com' })).toEqual({
      valid: false, reason: 'invalid_email',
    });
  });
  test('fails when password is under 8 characters', () => {
    expect(validateStep1({ ...validInput, pw: 'short', pw2: 'short' })).toEqual({
      valid: false, reason: 'weak_password',
    });
  });
  test('fails when passwords do not match', () => {
    expect(validateStep1({ ...validInput, pw2: 'different123' })).toEqual({
      valid: false, reason: 'password_mismatch',
    });
  });
});

describe('validateStep2 (signup profile)', () => {
  const validInput = { name: 'Pratiksha', faculty: 'Computing', year: 'Year 2', goal: 'Meet new friends' };

  test('passes with valid input', () => {
    expect(validateStep2(validInput)).toEqual({ valid: true });
  });
  test('fails when name is missing', () => {
    expect(validateStep2({ ...validInput, name: '' })).toEqual({
      valid: false, reason: 'missing_fields',
    });
  });
  test('fails when faculty is missing', () => {
    expect(validateStep2({ ...validInput, faculty: '' })).toEqual({
      valid: false, reason: 'missing_fields',
    });
  });
  test('fails when year is missing', () => {
    expect(validateStep2({ ...validInput, year: '' })).toEqual({
        valid: false, reason: 'missing_fields',
    });
  });
  test('fails when goal is missing', () => {
    expect(validateStep2({ ...validInput, goal: '' })).toEqual({
        valid: false, reason: 'missing_fields',
    });
  });
});