/*
 * Hide.Code.Mail — dot-and-case tagging cipher for email addresses
 * -------------------------------------------------------------------------
 * WHAT THIS FILE DOES
 * Gmail® (not affiliated) (and Google® Workspace (not affiliated)
 * addresses on gmail.com / googlemail.com) ignores dots in the local
 * part of an address, and ignores letter case. This is a
 * documented, ordinary feature of that service, not a bug or a loophole
 * — this file simply makes use of it, the same way it would make use of
 * the same behaviour on any other provider that happens to offer it.
 * (Gmail® and Google® Workspace are trademarks of Google® LLC (not
 * affiliated), a subsidiary of Alphabet® Inc. (likewise not affiliated
 * with this project). Alphabet® is itself a separate registered
 * trademark too, held by Alphabet® Inc.; see README.md for the full
 * trademark notice.)
 *
 *     piero.dellafrancesca@gmail.com
 *     pIero.dellaFrancesca@gmail.com
 *     pi.ero.della.francesca@gmail.com
 *
 * ...all deliver to the exact same inbox. This means the *position* of the
 * dots and the *case* of each letter is completely free real estate: it
 * carries zero delivery meaning, so we can use it to carry OUR meaning
 * instead — a short tag identifying who we gave this specific variant of
 * our address to, encoded directly into the address string itself.
 *
 * There is no database anywhere. The tag is not looked up, it is computed,
 * both ways. The address, run through the algorithm below, IS the tag.
 *
 * The full derivation and reasoning is written out in docs/ALGORITHM.md.
 * This file is the direct implementation of that document. Every function
 * below is deliberately verbose with console.log tracing, so opening the
 * browser console while using the page doubles as a live walkthrough of
 * the maths.
 * -------------------------------------------------------------------------
 */

"use strict";

// A small custom error type so the UI layer can distinguish "this input is
// invalid" from "something in the code broke".
class HideCodeMailError extends Error {
  constructor(message) {
    super(message);
    this.name = "HideCodeMailError";
  }
}

// The alphabet we allow for tags: lowercase letters and digits, 36 symbols
// total. This lines up neatly with JavaScript's native base-36 support on
// numbers and BigInts, so we do not need to hand-roll a custom base.
const TAG_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
const TAG_ALPHABET_REGEX = /^[a-z0-9]*$/;

// The two domains where the "dots are ignored" behaviour is a documented
// Gmail®/Google® Workspace feature (Gmail® and Google® are trademarks of
// Google® LLC, unrelated to and not affiliated with this project). We make
// no promise about it either way — it was tested by the author and worked
// as described on these domains at the time of testing, nothing more.
// Other providers may offer similar normalisation on their own domains;
// this tool simply makes use of whichever behaviour is actually there, it
// does not need Gmail® specifically. Case-insensitivity is close to
// universal across mail providers, but dot-stripping specifically is not,
// so we warn (not block) when the domain looks different.
const DOT_INSENSITIVE_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/* ---------------------------------------------------------------------- *
 * SECTION 0 — Plus-addressing and real-world character rules
 * ---------------------------------------------------------------------- */

/*
 * A real Gmail® username (checked directly against Google®'s own account
 * sign-up rules) can only ever contain lowercase letters, digits and dots.
 * Hyphens, underscores, apostrophes, ampersands and a handful of other
 * characters are explicitly rejected at sign-up, so they can never appear
 * in a genuine gmail.com mailbox name.
 *
 * The plus sign is a different feature entirely ("plus addressing"): it
 * was never part of the username, and everything from the first '+' to
 * the end of the local part is ignored by Gmail® for delivery purposes,
 * while still being shown to the recipient. Because Hide.Code.Mail's whole
 * approach relies on Gmail® *silently* normalising dots and case, and the
 * +suffix is neither silent nor normalised the same way, Hide.Code.Mail leaves it alone:
 * the cipher only ever touches the part of the address before the '+'.
 */
const GMAIL_USERNAME_CHAR_REGEX = /^[a-z0-9.]*$/i;

/**
 * Splits a local part into the part Hide.Code.Mail will cipher ("core") and any
 * plus-addressing suffix, which is passed through untouched.
 */
function splitPlusSuffix(local) {
  const plusIndex = local.indexOf("+");
  const result =
    plusIndex === -1
      ? { core: local, plusSuffix: "" }
      : { core: local.slice(0, plusIndex), plusSuffix: local.slice(plusIndex) };

  console.log(`[Hide.Code.Mail] splitPlusSuffix(): "${local}" -> core="${result.core}" plusSuffix="${result.plusSuffix}"`);
  return result;
}

/**
 * Returns the distinct characters in `core` that a real Gmail® username is
 * not allowed to contain (anything other than a-z, 0-9 and dots).
 */
function findInvalidGmailChars(core) {
  const invalid = [];
  for (const ch of core) {
    if (!/[a-z0-9.]/i.test(ch) && !invalid.includes(ch)) invalid.push(ch);
  }
  return invalid;
}

/* ---------------------------------------------------------------------- *
 * SECTION 1 — Parsing and canonical form
 * ---------------------------------------------------------------------- */

/**
 * Splits "local@domain" into its two parts and does basic sanity checks.
 * We deliberately keep validation light: this is a text-transformation
 * toy, not a mail-server, so we do not need full RFC 5321 compliance.
 */
function splitEmail(email) {
  console.log("[Hide.Code.Mail] splitEmail(): raw input ->", email);

  const trimmed = (email || "").trim();
  const atIndex = trimmed.indexOf("@");

  if (atIndex <= 0 || atIndex !== trimmed.lastIndexOf("@")) {
    throw new HideCodeMailError(
      "That does not look like a valid email address (need exactly one '@', with something before it)."
    );
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (!domain.includes(".")) {
    throw new HideCodeMailError("The domain part of the address looks incomplete.");
  }

  console.log("[Hide.Code.Mail] splitEmail(): local =", local, "| domain =", domain);
  return { local, domain };
}

/**
 * Reduces a local part to its canonical identity: strip every dot, force
 * lowercase. This is what Gmail® actually treats as "the address" — every
 * dot/case variant we produce or read maps back to exactly this string.
 */
function canonicalise(local) {
  const canonical = local.replace(/\./g, "").toLowerCase();
  console.log("[Hide.Code.Mail] canonicalise():", local, "->", canonical);
  return canonical;
}

/* ---------------------------------------------------------------------- *
 * SECTION 2 — Capacity: how many bits, how many tag characters
 * ---------------------------------------------------------------------- */

/**
 * Given the canonical local part, returns the two slot counts:
 *  - caseSlotCount: one slot per alphabetic character (digits have no case)
 *  - gapSlotCount: one slot per gap between two consecutive characters
 *    (a local part of length n has exactly n - 1 internal gaps; dots can
 *    never sit before the first character or after the last one, and two
 *    dots can never be adjacent, both of which fall out naturally from
 *    this "one gap, one optional dot" model)
 */
function computeSlots(canonicalLocal) {
  const n = canonicalLocal.length;
  let caseSlotCount = 0;

  for (const ch of canonicalLocal) {
    if (/[a-z]/i.test(ch)) caseSlotCount += 1;
  }

  const gapSlotCount = Math.max(n - 1, 0);
  const totalBits = caseSlotCount + gapSlotCount;

  console.log(
    `[Hide.Code.Mail] computeSlots(): n=${n}, caseSlots=${caseSlotCount}, gapSlots=${gapSlotCount}, totalBits=${totalBits}`
  );

  return { n, caseSlotCount, gapSlotCount, totalBits };
}

/**
 * Works out the maximum tag length (in a-z0-9 characters) that fits inside
 * a given number of bits. We prepend a one-digit, non-zero "sentinel" to
 * every tag before converting it to a number (see encodeTag below), so the
 * capacity check has to account for that extra digit too.
 *
 * We find the largest L such that a (L + 1)-digit base-36 number (sentinel
 * plus L tag digits) can never exceed what totalBits bits can represent.
 */
function maxTagLength(totalBits) {
  if (totalBits <= 0) return 0;

  const capacity = (1n << BigInt(totalBits)) - 1n; // 2^totalBits - 1, as BigInt
  let length = 0;

  // Safety cap: no realistic email local part exceeds a few hundred
  // characters, so a few hundred iterations is always enough. This just
  // stops a pathological input from looping forever.
  const SAFETY_CAP = 2000;

  while (length < SAFETY_CAP) {
    const digitsIncludingSentinel = BigInt(length + 1 + 1); // sentinel + (length+1) tag chars
    const largestValueAtThisLength = 36n ** digitsIncludingSentinel - 1n;

    if (largestValueAtThisLength <= capacity) {
      length += 1;
    } else {
      break;
    }
  }

  console.log(`[Hide.Code.Mail] maxTagLength(): totalBits=${totalBits} -> max ${length} characters`);
  return length;
}

/* ---------------------------------------------------------------------- *
 * SECTION 3 — Tag <-> integer <-> bits
 * ---------------------------------------------------------------------- */

/**
 * Turns a tag string into a BigInt, with a leading sentinel digit '1' so
 * that leading zero-digits inside the tag (e.g. tag "05x") are preserved
 * when we later convert the integer back into text. Without the sentinel,
 * "05x" and "5x" would collapse to the same number.
 */
function tagToInteger(tag) {
  const framed = "1" + tag; // sentinel + tag, all in [a-z0-9]
  let value = 0n;

  for (const ch of framed) {
    const digitValue = BigInt(parseInt(ch, 36));
    value = value * 36n + digitValue;
  }

  console.log(`[Hide.Code.Mail] tagToInteger(): tag="${tag}" framed="${framed}" -> ${value.toString()}`);
  return value;
}

/**
 * Reverses tagToInteger(): BigInt -> base-36 string -> drop the sentinel.
 */
function integerToTag(value) {
  if (value === 0n) {
    console.log("[Hide.Code.Mail] integerToTag(): value is 0, no sentinel present -> no tag embedded");
    return null; // 0 means "no encoding was ever applied" (plain address)
  }

  const framed = value.toString(36); // BigInt supports radix 2-36 natively
  const tag = framed.slice(1); // drop the leading sentinel digit

  console.log(`[Hide.Code.Mail] integerToTag(): value=${value.toString()} framed="${framed}" -> tag="${tag}"`);
  return tag;
}

/**
 * Integer -> fixed-length binary string, left-padded with zeros so it is
 * exactly totalBits long (the exact number of slots we have available).
 */
function integerToBits(value, totalBits) {
  const raw = value.toString(2);

  if (raw.length > totalBits) {
    throw new HideCodeMailError(
      "The tag is too long for this address: it needs more bits than the address can carry."
    );
  }

  const padded = raw.padStart(totalBits, "0");
  console.log(`[Hide.Code.Mail] integerToBits(): value=${value.toString()} -> "${padded}" (${totalBits} bits)`);
  return padded;
}

function bitsToInteger(bits) {
  const value = bits.length === 0 ? 0n : BigInt("0b" + bits);
  console.log(`[Hide.Code.Mail] bitsToInteger(): "${bits}" -> ${value.toString()}`);
  return value;
}

/* ---------------------------------------------------------------------- *
 * SECTION 4 — Encoding: canonical local part + tag -> tagged local part
 * ---------------------------------------------------------------------- */

/**
 * Applies a bitstring of case flags and dot flags onto the canonical local
 * part, producing the final, taggable local part.
 *
 * Rule, spelled out plainly:
 *   - Walk the canonical characters left to right.
 *   - For every alphabetic character, consume the next case bit: if it is
 *     1, output the uppercase version of the letter; if it is 0, output
 *     the lowercase version. Non-alphabetic characters are copied through
 *     unchanged (they have no case bit at all).
 *   - Between every pair of consecutive characters, consume the next gap
 *     bit: if it is 1, output a '.' between them; if it is 0, output
 *     nothing there.
 */
function applyBits(canonicalLocal, caseBits, gapBits) {
  let output = "";
  let caseCursor = 0;
  let gapCursor = 0;

  for (let i = 0; i < canonicalLocal.length; i++) {
    const ch = canonicalLocal[i];

    if (/[a-z]/i.test(ch)) {
      const flag = caseBits[caseCursor];
      caseCursor += 1;
      output += flag === "1" ? ch.toUpperCase() : ch.toLowerCase();
    } else {
      output += ch;
    }

    const isLastChar = i === canonicalLocal.length - 1;
    if (!isLastChar) {
      const flag = gapBits[gapCursor];
      gapCursor += 1;
      if (flag === "1") output += ".";
    }
  }

  console.log(`[Hide.Code.Mail] applyBits(): "${canonicalLocal}" + bits -> "${output}"`);
  return output;
}

/**
 * Full encode pipeline: email + tag -> tagged email.
 * Returns a result object with the tagged address plus the intermediate
 * values, so the UI can show a "how this was computed" trace if wanted.
 */
function encodeAddress(rawEmail, tag) {
  console.log("=== Hide.Code.Mail ENCODE start ===");

  const { local, domain } = splitEmail(rawEmail);
  const domainIsDotInsensitive = DOT_INSENSITIVE_DOMAINS.has(domain.toLowerCase());
  const { core, plusSuffix } = splitPlusSuffix(local);

  if (domainIsDotInsensitive) {
    const invalidChars = findInvalidGmailChars(core);
    if (invalidChars.length > 0) {
      const quoted = invalidChars.map((c) => `"${c}"`).join(", ");
      throw new HideCodeMailError(
        `${quoted} ${invalidChars.length === 1 ? "is" : "are"} not valid in a real Gmail® username ` +
          `(only letters, digits and dots are allowed there — Gmail® rejects hyphens, underscores, ` +
          `apostrophes and similar characters at sign-up, so an address containing them cannot exist).`
      );
    }
  }

  const canonicalLocal = canonicalise(core);

  if (canonicalLocal.length === 0) {
    throw new HideCodeMailError("The part before the '@' (or before any '+') cannot be empty.");
  }

  const normalisedTag = (tag || "").trim().toLowerCase();
  if (!TAG_ALPHABET_REGEX.test(normalisedTag)) {
    throw new HideCodeMailError("A tag can only contain lowercase letters a-z and digits 0-9.");
  }

  const { caseSlotCount, gapSlotCount, totalBits } = computeSlots(canonicalLocal);
  const capacity = maxTagLength(totalBits);

  if (normalisedTag.length > capacity) {
    throw new HideCodeMailError(
      `This address can only carry up to ${capacity} character(s). "${normalisedTag}" is ${normalisedTag.length}.`
    );
  }

  const value = tagToInteger(normalisedTag);
  const bits = integerToBits(value, totalBits);
  const caseBits = bits.slice(0, caseSlotCount);
  const gapBits = bits.slice(caseSlotCount);

  // The plus-suffix, if any, was deliberately excluded from the cipher
  // above (see SECTION 0) and is reattached here exactly as the user
  // typed it.
  const taggedLocal = applyBits(canonicalLocal, caseBits, gapBits) + plusSuffix;
  const taggedEmail = `${taggedLocal}@${domain.toLowerCase()}`;

  console.log("=== Hide.Code.Mail ENCODE result:", taggedEmail, "===");

  return {
    taggedEmail,
    canonicalLocal,
    caseSlotCount,
    gapSlotCount,
    totalBits,
    capacity,
    caseBits,
    gapBits,
    domainIsDotInsensitive,
    plusSuffix,
  };
}

/* ---------------------------------------------------------------------- *
 * SECTION 5 — Decoding: tagged local part -> canonical local part + tag
 * ---------------------------------------------------------------------- */

/**
 * Reads a tagged local part and recovers the case bits and gap bits that
 * were used to build it, by comparing each character against its own
 * case and by checking whether a '.' sits immediately before it.
 */
function extractBits(taggedLocal) {
  let caseBits = "";
  let gapBits = "";
  let canonicalLocal = "";
  let sawDotBeforeCurrentChar = false;
  let isFirstChar = true;

  for (const ch of taggedLocal) {
    if (ch === ".") {
      sawDotBeforeCurrentChar = true;
      continue; // dots are not "characters" of the canonical address
    }

    if (!isFirstChar) {
      gapBits += sawDotBeforeCurrentChar ? "1" : "0";
    }
    sawDotBeforeCurrentChar = false;
    isFirstChar = false;

    if (/[a-z]/i.test(ch)) {
      caseBits += ch === ch.toUpperCase() ? "1" : "0";
    }

    canonicalLocal += ch.toLowerCase();
  }

  console.log(
    `[Hide.Code.Mail] extractBits(): "${taggedLocal}" -> canonical="${canonicalLocal}" caseBits="${caseBits}" gapBits="${gapBits}"`
  );

  return { canonicalLocal, caseBits, gapBits };
}

/**
 * Full decode pipeline: tagged email -> canonical email + recovered tag.
 */
function decodeAddress(rawEmail) {
  console.log("=== Hide.Code.Mail DECODE start ===");

  const { local, domain } = splitEmail(rawEmail);
  const domainIsDotInsensitive = DOT_INSENSITIVE_DOMAINS.has(domain.toLowerCase());
  const { core, plusSuffix } = splitPlusSuffix(local);

  // Decoding is deliberately lenient: someone reading back an address they
  // already have should not be blocked, so an invalid-for-Gmail® character
  // is reported as a note rather than an error (see SECTION 0).
  const invalidChars = domainIsDotInsensitive ? findInvalidGmailChars(core) : [];

  const { canonicalLocal, caseBits, gapBits } = extractBits(core);

  if (canonicalLocal.length === 0) {
    throw new HideCodeMailError("The part before the '@' (or before any '+') cannot be empty.");
  }

  const bits = caseBits + gapBits;
  const value = bitsToInteger(bits);
  const tag = integerToTag(value);

  const canonicalEmail = `${canonicalLocal}@${domain.toLowerCase()}`;

  console.log("=== Hide.Code.Mail DECODE result: tag =", tag, "===");

  return {
    canonicalEmail,
    tag, // null if no tag was ever embedded
    caseBits,
    gapBits,
    domainIsDotInsensitive,
    plusSuffix,
    invalidChars,
  };
}

/* ---------------------------------------------------------------------- *
 * SECTION 6 — UI wiring
 * ---------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  console.log("[Hide.Code.Mail] UI ready.");

  const modeEncodeBtn = document.getElementById("mode-encode");
  const modeDecodeBtn = document.getElementById("mode-decode");

  const encodePanel = document.getElementById("panel-encode");
  const decodePanel = document.getElementById("panel-decode");

  const encodeEmailInput = document.getElementById("encode-email");
  const encodeTagInput = document.getElementById("encode-tag");
  const encodeCapacityHint = document.getElementById("encode-capacity-hint");
  const encodeResult = document.getElementById("encode-result");
  const encodeTrace = document.getElementById("encode-trace");
  const encodeCopyBtn = document.getElementById("encode-copy");

  const decodeEmailInput = document.getElementById("decode-email");
  const decodeResult = document.getElementById("decode-result");
  const decodeTrace = document.getElementById("decode-trace");

  const disclaimerCheckbox = document.getElementById("disclaimer-accept");
  const disclaimerLabel = document.getElementById("disclaimer-accept-label");
  const encodeGenerateBtn = document.getElementById("encode-generate");
  const decodeGenerateBtn = document.getElementById("decode-generate");

  function disclaimerAccepted() {
    return disclaimerCheckbox.checked;
  }

  function shakeDisclaimer() {
    disclaimerLabel.classList.remove("shake");
    // Force reflow so the animation can be retriggered on repeated clicks.
    void disclaimerLabel.offsetWidth;
    disclaimerLabel.classList.add("shake");
    disclaimerLabel.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function setMode(mode) {
    const isEncode = mode === "encode";
    modeEncodeBtn.classList.toggle("is-active", isEncode);
    modeDecodeBtn.classList.toggle("is-active", !isEncode);
    encodePanel.hidden = !isEncode;
    decodePanel.hidden = isEncode;
    console.log("[Hide.Code.Mail] mode switched to", mode);
  }

  modeEncodeBtn.addEventListener("click", () => setMode("encode"));
  modeDecodeBtn.addEventListener("click", () => setMode("decode"));

  function renderBitStrip(container, caseBits, gapBits) {
    container.innerHTML = "";

    const makeGroup = (label, bits) => {
      const group = document.createElement("div");
      group.className = "bit-group";

      const groupLabel = document.createElement("span");
      groupLabel.className = "bit-group-label";
      groupLabel.textContent = label;
      group.appendChild(groupLabel);

      const dots = document.createElement("div");
      dots.className = "bit-dots";
      for (const b of bits) {
        const dot = document.createElement("span");
        dot.className = "bit-dot" + (b === "1" ? " is-on" : "");
        dots.appendChild(dot);
      }
      group.appendChild(dots);
      return group;
    };

    container.appendChild(makeGroup("case bits", caseBits));
    container.appendChild(makeGroup("gap bits", gapBits));
  }

  function updateCapacityHint() {
    try {
      const { local } = splitEmail(encodeEmailInput.value || "x@gmail.com");
      const { core } = splitPlusSuffix(local);
      const canonicalLocal = canonicalise(core);
      const { totalBits } = computeSlots(canonicalLocal);
      const capacity = maxTagLength(totalBits);
      encodeTagInput.maxLength = Math.max(capacity, 0);
      encodeCapacityHint.textContent =
        canonicalLocal.length > 0
          ? `This address can carry up to ${capacity} character${capacity === 1 ? "" : "s"} (a-z, 0-9).`
          : "Type an email address to see how many characters you can hide.";
    } catch (err) {
      encodeCapacityHint.textContent = "Type a valid email address to see the available capacity.";
    }
  }

  encodeEmailInput.addEventListener("input", updateCapacityHint);
  updateCapacityHint();

  function runEncode() {
    encodeResult.classList.remove("is-error");
    try {
      const result = encodeAddress(encodeEmailInput.value, encodeTagInput.value);
      encodeResult.textContent = result.taggedEmail;
      encodeCopyBtn.hidden = false;
      encodeCopyBtn.dataset.value = result.taggedEmail;

      renderBitStrip(encodeTrace, result.caseBits, result.gapBits);

      if (result.plusSuffix) {
        encodeResult.textContent += `  (kept "${result.plusSuffix}" as-is — Hide.Code.Mail doesn't cipher plus-addressing)`;
      }
      if (!result.domainIsDotInsensitive) {
        encodeResult.textContent += "  (note: dots were only tested as ignored on gmail.com / googlemail.com — no guarantee for other domains)";
      }
    } catch (err) {
      encodeResult.textContent = err instanceof HideCodeMailError ? err.message : "Something went wrong.";
      encodeResult.classList.add("is-error");
      encodeCopyBtn.hidden = true;
      encodeTrace.innerHTML = "";
      console.error(err);
    }
  }

  encodeGenerateBtn.addEventListener("click", () => {
    if (!disclaimerAccepted()) {
      shakeDisclaimer();
      return;
    }
    runEncode();
  });

  encodeCopyBtn.addEventListener("click", async () => {
    const value = encodeCopyBtn.dataset.value || "";
    try {
      await navigator.clipboard.writeText(value);
      encodeCopyBtn.textContent = "Copied";
      setTimeout(() => (encodeCopyBtn.textContent = "Copy"), 1200);
    } catch (err) {
      console.warn("[Hide.Code.Mail] clipboard write failed", err);
    }
  });

  function runDecode() {
    decodeResult.classList.remove("is-error");
    try {
      const result = decodeAddress(decodeEmailInput.value);
      if (result.tag === null) {
        decodeResult.textContent = `No tag detected. This is a plain address: ${result.canonicalEmail}`;
      } else {
        decodeResult.textContent = `Tag: "${result.tag}"  ·  underlying address: ${result.canonicalEmail}`;
      }

      renderBitStrip(decodeTrace, result.caseBits, result.gapBits);

      if (result.plusSuffix) {
        decodeResult.textContent += `  (ignored plus-addressing suffix "${result.plusSuffix}")`;
      }
      if (result.invalidChars && result.invalidChars.length > 0) {
        const quoted = result.invalidChars.map((c) => `"${c}"`).join(", ");
        decodeResult.textContent += `  (note: contains ${quoted}, which a real Gmail® username cannot have)`;
      }
      if (!result.domainIsDotInsensitive) {
        decodeResult.textContent += "  (note: not a gmail.com / googlemail.com address)";
      }
    } catch (err) {
      decodeResult.textContent = err instanceof HideCodeMailError ? err.message : "Something went wrong.";
      decodeResult.classList.add("is-error");
      decodeTrace.innerHTML = "";
      console.error(err);
    }
  }

  decodeGenerateBtn.addEventListener("click", () => {
    if (!disclaimerAccepted()) {
      shakeDisclaimer();
      return;
    }
    runDecode();
  });
});
