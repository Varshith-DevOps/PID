import { describe, it, expect } from 'vitest';
import {
  required, email, mobile, phone, personName, amount, nonNegative, integer,
  percentage, password, url, pan, aadhaar, ifsc, gstin, bankAccount, uan,
  pincode, cin, din, compose, optional, matches, validateForm,
  onlyDigits, onlyDecimal, upperAlnum, onlyAlpha,
} from '@/lib/validators';

// Convention under test: validators return an error string when invalid, or null when valid.
const ok = (v: string | null) => expect(v).toBeNull();
const bad = (v: string | null) => expect(typeof v).toBe('string');

describe('generic validators', () => {
  it('required: rejects empty/whitespace, accepts content', () => {
    bad(required()(''));
    bad(required()('   '));
    ok(required()('x'));
  });

  it('email: accepts well-formed, rejects malformed', () => {
    ok(email('name@company.com'));
    bad(email('no-at'));
    bad(email('a@b'));           // no dot after @
    bad(email('a b@c.com'));     // space
    bad(email(''));
  });

  it('mobile: exactly 10 digits starting 6-9', () => {
    ok(mobile('9876543210'));
    bad(mobile('1234567890'));   // starts < 6
    bad(mobile('98765'));        // too short
    bad(mobile('98765432a0'));   // non-digit
  });

  it('phone: optional but bounded 7-15 digits with optional +', () => {
    ok(phone(''));               // optional
    ok(phone('+911234567'));
    bad(phone('123'));
  });

  it('personName: letters only, min length, custom label in message', () => {
    ok(personName()("O'Brien-Smith"));
    bad(personName()('A'));      // too short
    bad(personName('First name')('John3'));
    expect(personName('First name')('')).toContain('First name');
  });

  it('amount: positive numbers only', () => {
    ok(amount('250'));
    bad(amount('0'));
    bad(amount('-5'));
    bad(amount('abc'));
  });

  it('nonNegative / integer', () => {
    ok(nonNegative()('0'));
    bad(nonNegative()('-1'));
    ok(integer()('42'));
    bad(integer()('4.2'));
  });

  it('percentage: 0..100 inclusive', () => {
    ok(percentage('0'));
    ok(percentage('100'));
    bad(percentage('101'));
    bad(percentage('-1'));
  });

  it('password: 12+ chars with upper/lower/number/symbol', () => {
    ok(password('StrongPass1!'));
    bad(password('short1!A'));        // < 12
    bad(password('alllowercase1!'));  // no upper
    bad(password('NoNumber!!AA'));    // no digit
    bad(password('NoSymbol12345'));   // no symbol
  });

  it('url: optional, requires http(s)', () => {
    ok(url(''));
    ok(url('https://example.com'));
    bad(url('ftp://example.com'));
  });
});

describe('India-specific identifiers', () => {
  it('pan: ABCDE1234F shape (case-insensitive input)', () => {
    ok(pan('ABCDE1234F'));
    ok(pan('abcde1234f'));   // normalised to upper
    bad(pan('ABCD1234F'));   // 4 leading letters
    bad(pan('ABCDE12345'));  // trailing must be a letter
  });

  it('aadhaar: 12 digits, spaces tolerated', () => {
    ok(aadhaar('1234 5678 9012'));
    bad(aadhaar('1234'));
  });

  it('ifsc: 4 letters + 0 + 6 alnum', () => {
    ok(ifsc('HDFC0001234'));
    bad(ifsc('HDFC1001234'));   // 5th char must be 0
  });

  it('gstin: 15-char structure', () => {
    ok(gstin('27ABCDE1234F1Z5'));
    bad(gstin('27ABCDE1234F1A5')); // 14th char must be Z
    bad(gstin('ABCDE1234F1Z5'));   // too short
  });

  it('bankAccount / uan / pincode / cin / din', () => {
    ok(bankAccount('123456789'));
    bad(bankAccount('123'));
    ok(uan(''));                 // optional
    bad(uan('123'));
    ok(pincode('560001'));
    bad(pincode('012345'));      // cannot start with 0
    ok(cin('U12345KA2020PTC123456'));
    bad(cin('X12345KA2020PTC123456'));
    ok(din('12345678'));
    bad(din('1234'));
  });
});

describe('combinators', () => {
  it('compose returns the first error, or null when all pass', () => {
    const v = compose(required('Email'), email);
    bad(v(''));                  // required fires first
    bad(v('not-an-email'));      // email fires
    ok(v('a@b.com'));
  });

  it('optional skips validation for empty values', () => {
    ok(optional(pan)(''));       // empty -> skipped
    bad(optional(pan)('bad'));   // non-empty -> validated
  });

  it('matches compares against another field', () => {
    ok(matches(() => 'secret')('secret'));
    bad(matches(() => 'secret', 'Passwords')('different'));
  });
});

describe('validateForm', () => {
  it('aggregates errors and reports validity + first error', () => {
    const rules = { email, mobile };
    const fail = validateForm({ email: 'bad', mobile: '9876543210' }, rules);
    expect(fail.isValid).toBe(false);
    expect(fail.errors).toHaveProperty('email');
    expect(fail.errors).not.toHaveProperty('mobile');
    expect(fail.firstError).toBe(fail.errors.email);

    const pass = validateForm({ email: 'a@b.com', mobile: '9876543210' }, rules);
    expect(pass.isValid).toBe(true);
    expect(pass.firstError).toBeNull();
  });
});

describe('input restrictors', () => {
  it('onlyDigits strips non-digits and caps length', () => {
    expect(onlyDigits('98a76-54')).toBe('987654');
    expect(onlyDigits('123456', 4)).toBe('1234');
  });
  it('onlyDecimal keeps a single dot', () => {
    expect(onlyDecimal('12.3.4')).toBe('12.34');
    expect(onlyDecimal('1a2.b3')).toBe('12.3');
  });
  it('upperAlnum uppercases and strips symbols', () => {
    expect(upperAlnum('hdfc-0001', 11)).toBe('HDFC0001');
  });
  it('onlyAlpha keeps letters, spaces and name punctuation', () => {
    expect(onlyAlpha("John3 O'Brien!")).toBe("John O'Brien");
  });
});
