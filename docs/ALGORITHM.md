# The Hide.Code.Mail algorithm

This document explains, from first principles, how Hide.Code.Mail hides a short
tag inside a Gmail® (not affiliated) address using only dots and letter
case, with no database, no server, and no state stored anywhere. The
address itself is the entire memory of the system.

> Gmail® and Google® (not affiliated) are registered trademarks of
> Google® LLC (not affiliated; a subsidiary of Alphabet Inc., likewise
> not affiliated with this project). They are named here only in a
> descriptive sense, to explain the specific, publicly documented
> behaviour this document is about — this is simply using an existing
> feature, not exploiting or working around anything. This project is
> not affiliated with, sponsored by, or endorsed by Google® LLC, Alphabet
> Inc., or any other email provider — see the full
> [trademark notice](../README.md#trademark-notice) in the main README.

## 1. The premise

Gmail® (and Google® Workspace (not affiliated) addresses on `gmail.com`
and `googlemail.com`) normalises the local part of an address before
delivery in two ways:

1. **Dots are stripped.** `piero.dellafrancesca`, `p.iero.dellafrancesca` and
   `pierodellafrancesca` are the same mailbox.
2. **Case is ignored.** `PIERO.DELLAFRANCESCA` and `piero.dellafrancesca` are the
   same mailbox.

Neither of these carries any delivery information. From Gmail®'s point of
view they are pure noise. Hide.Code.Mail treats that noise as a channel: a place
to put information that only means something if you know how to read it
back out, and that costs the sender nothing extra to send.

## 2. Canonical form

Given any address, its **canonical form** is obtained by removing every
dot from the local part and lowercasing what remains:

```
pIero.dell.afra.ncesca@gmail.com  ->  pierodellafrancesca@gmail.com
```

This is the address as Gmail® actually sees it. Every dot/case variant of
an address maps to exactly one canonical form, and the canonical form is
the anchor the whole scheme is built on.

## 3. Real-world character constraints, and plus-addressing

The scheme above assumes every character in the local part can carry a
case bit and sit next to a dot. Two real Gmail® behaviours narrow that
slightly, and Hide.Code.Mail accounts for both directly rather than glossing
over them.

**Only `a-z`, `0-9` and `.` are real Gmail® characters.** Google®'s own
account sign-up rules explicitly reject hyphens, underscores, apostrophes,
ampersands, equals signs, commas and angle brackets in a username. That
means a hyphen or underscore can never appear in a genuine `gmail.com`
mailbox name: an address containing one is not a real Gmail® account.
Hide.Code.Mail checks for this on `gmail.com` / `googlemail.com` addresses: when
hiding a tag, it refuses to build a tagged address around characters that
Gmail® itself would never allow to exist, with an error naming the
offending character. When reading a tag back out, it is deliberately more
forgiving: an address that is already in front of you gets decoded
regardless, with a note if it contains characters no real Gmail® username
could have. Other domains are not restricted this way, since plenty of
providers do allow hyphens and underscores in addresses.

**Plus-addressing is a separate feature, and Hide.Code.Mail leaves it alone.**
Anything from the first `+` in the local part to the `@` was never part
of the username to begin with; Gmail® ignores it entirely for delivery
while still showing it to the recipient (`name+shop@gmail.com` and
`name@gmail.com` are the same inbox). This is already a tagging
mechanism, just a much more visible one than dots and case. Because it is
not silently normalised the way dots and case are, Hide.Code.Mail splits it off
before doing anything else: the cipher in the sections below only ever
runs on the part of the address before the `+`, and the `+suffix`, if
any, is reattached unchanged at the very end. A tag hidden this way still
fits inside an address that also uses `+` for its own, separate purpose.

## 4. Counting the available slots

Let `n` be the number of characters in the canonical local part.

- **Case slots.** Every alphabetic character can independently be
  uppercase or lowercase. Digits have no case, so they do not contribute
  a slot (and, as section 3 covers, on `gmail.com` letters and digits are
  the only characters that can legitimately appear here at all). Call
  this count `caseSlotCount`.
- **Gap slots.** Between every pair of consecutive characters there is
  exactly one place a dot could go. A local part of length `n` has `n - 1`
  such gaps (never before the first character, never after the last one).
  Call this count `gapSlotCount`.

The total number of independent yes/no slots is:

```
totalBits = caseSlotCount + gapSlotCount
```

Because each slot is binary, the address can represent any one of
`2^totalBits` distinct patterns. This is the entire "keyspace": a longer
local part gives more slots and therefore exponentially more patterns,
which is why the tool reports a capacity in characters that grows with
the address, not a fixed number.

Note this model also explains two Gmail® rules for free: dots can never be
adjacent (each gap can hold at most one dot) and never lead or trail
(there is no gap before the first character or after the last one).

## 5. Turning a tag into bits

A tag is any string made of lowercase letters and digits (`a-z0-9`, 36
symbols). To turn it into a fixed-length bitstring:

1. **Prefix a sentinel digit.** The tag `05x` and the tag `5x` would
   collapse to the same integer if converted naively, because leading
   zero-digits vanish once a string is read as a number. To prevent this,
   a fixed non-zero digit (`1`) is prepended before any conversion:
   `05x` becomes `105x`, `5x` becomes `15x`. These are now different
   numbers, and the sentinel is always stripped back off on the way out.
2. **Read the framed tag as a base-36 number.** Each character maps to a
   value 0-35 (`0`-`9`, then `a`-`z`), and the whole string is read
   positionally, exactly the way a decimal string is read as a decimal
   number, only in base 36 instead of base 10.
3. **Convert that number to binary**, left-padded with zeros until it is
   exactly `totalBits` digits long. If the number does not fit in
   `totalBits` bits, the tag is too long for this address, and encoding
   fails with a clear message rather than silently truncating.

## 6. Applying the bits to the address

The `totalBits`-long binary string is split into two contiguous pieces,
in this fixed order:

```
[ case bits (caseSlotCount digits) ][ gap bits (gapSlotCount digits) ]
```

They are then applied to the canonical local part in a single left-to-right
pass:

- Walking the characters in order, every alphabetic character consumes
  the next unused case bit: a `1` means "write this letter uppercase", a
  `0` means "write it lowercase". Non-alphabetic characters are copied
  through unchanged.
- Between every pair of consecutive characters, the next unused gap bit is
  consumed: a `1` means "insert a dot here", a `0` means "insert nothing".

The result is the tagged address: a string that still decodes to exactly
the same mailbox, but whose specific shape encodes the tag.

## 7. Reading a tag back out

Decoding runs the same process in reverse, and needs nothing but the
tagged address itself:

1. Scan the local part character by character. Every time a letter is
   seen, record whether it is uppercase (`1`) or lowercase (`0`); this
   rebuilds the case-bit sequence in order. Every time a `.` is seen,
   remember that the *next* real character was preceded by a dot, and
   record a `1` (otherwise `0`) for that gap; this rebuilds the gap-bit
   sequence in order. Dots themselves are not characters of the canonical
   address and are simply consumed.
2. Concatenate the recovered case bits and gap bits, in that order, into
   one binary string, and read it back as an integer.
3. Convert that integer to a base-36 string. If the integer is zero, no
   sentinel was ever applied, meaning this is a plain, untagged address.
   Otherwise, drop the leading sentinel digit; what remains is the
   original tag.

Because encoding and decoding are built from the same slot ordering and
the same bit-to-character rules, the process is a clean, lossless
round-trip: `decode(encode(address, tag)) == tag`, for any tag that fits
inside the address's capacity.

## 8. Capacity in human terms

The tool reports capacity as "up to N characters" rather than "up to
`totalBits` bits", because a-z0-9 is what a person actually types. `N` is
the largest tag length such that a sentinel digit followed by `N` base-36
digits still fits under `2^totalBits - 1`, i.e. the largest `N` for which:

```
36^(N + 1) - 1 <= 2^totalBits - 1
```

Roughly, `N ≈ totalBits / log2(36) ≈ totalBits / 5.17`, but the tool
computes the exact integer value rather than relying on the approximation.

## 9. A worked example, start to finish

Abstract rules are easier to trust once seen working on real numbers. Take
the address `abcdef@gmail.com` and the tag `z`.

**Canonical form.** There are no dots to strip and it is already
lowercase, so the canonical local part is simply `abcdef`, `n = 6`.

**Slots.** All six characters are letters, so `caseSlotCount = 6`. There
are five gaps between six characters, so `gapSlotCount = 5`.
`totalBits = 11`, meaning this address can represent 2^11 = 2048 distinct
patterns.

**Tag to integer.** The tag `z` is framed with the sentinel digit as `1z`.
Read as base 36 (`1` = 1, `z` = 35):

```
value = 1 * 36 + 35 = 71
```

**Integer to bits.** 71 in binary is `1000111` (7 digits). Padded with
leading zeros to fill all 11 available slots:

```
00001000111
```

**Splitting the bits.** The first 6 digits are the case bits, the last 5
are the gap bits:

```
case bits: 0 0 0 0 1 0
gap  bits: 0 0 1 1 1
```

**Applying them.** Case bits map onto the letters a, b, c, d, e, f in
order; gap bits map onto the gaps a-b, b-c, c-d, d-e, e-f in order:

| letter        | a | b | c | d | e   | f |
|---------------|---|---|---|---|-----|---|
| case bit      | 0 | 0 | 0 | 0 | 1   | 0 |
| written as    | a | b | c | d | **E** | f |

| gap           | a-b | b-c | c-d | d-e | e-f |
|---------------|-----|-----|-----|-----|-----|
| gap bit       | 0   | 0   | 1   | 1   | 1   |
| dot inserted? | no  | no  | yes | yes | yes |

Assembling the result character by character gives `abc.d.E.f`, so the
tagged address is:

```
abc.d.E.f@gmail.com
```

**Decoding it back.** Reading `abc.d.E.f` left to right: only `E` is
uppercase, so the case bits are `000010`; a dot sits immediately before
`d`, `E` and `f`, so the gap bits are `00111`. Concatenated, that is
`00001000111` again, which is 71 in decimal. 71 in base 36 is `1z`;
dropping the sentinel digit leaves `z`, exactly the tag that went in.

This example, and the general round-trip property `decode(encode(address,
tag)) == tag`, is verified directly against the implementation in
`script.js`, not just derived on paper.

## 10. Scope and honesty about limits

- The scheme has no inherent length limit: the maths works identically
  for a local part of 5 characters or 500. In practice Gmail® caps the
  local part at 64 characters, which is the real, practical ceiling on
  capacity.
- The dot-stripping behaviour is a documented Gmail®/Google® Workspace
  feature on `gmail.com` and `googlemail.com`. We make no promise about
  it either way: it was tested by the author and worked as described at
  the time of testing, nothing more. Case-insensitivity is close to
  universal among mail providers, but dot-stripping specifically is not;
  Hide.Code.Mail will still compute correctly for any domain, but actual
  mail delivery to the same inbox was only ever tested on Gmail®'s own
  domains, and the tool flags this. If another provider happens to offer
  the same dot- and/or case-folding behaviour on its own addresses, this
  tool works with it exactly the same way — check that provider's own
  documentation first, since Hide.Code.Mail has no relationship with, and
  makes no claim about, any provider other than what is stated here.
- This is an obfuscation technique, not encryption, and it is easily
  defeated: nothing about the scheme is secret, so anyone who reads this
  document can decode any tagged address. It is not a real defence or
  security mechanism, and it is not meant to be one — it answers "who did
  I give this address to", with nothing to set up and no external
  service required, not "how do I hide this from someone who knows the
  method".
