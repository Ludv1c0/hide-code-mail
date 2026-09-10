# Hide.Code.Mail

Gmail® (not affiliated) ignores every dot and every letter case in the
part of an address before the `@`. `piero.dellafrancesca@gmail.com`,
`pIero.dellaFrancesca@gmail.com` and `pi.ero.della.francesca@gmail.com`
all deliver to the same inbox.

> Gmail® and Google® (not affiliated) are registered trademarks of
> Google® LLC (not affiliated; a subsidiary of Alphabet Inc., likewise
> not affiliated with this project). They are named here only in a
> descriptive sense, to identify an existing, publicly documented email
> feature this tool simply makes use of — not an exploit or a workaround
> of anything. Hide.Code.Mail is not affiliated with, sponsored by, or
> endorsed by Google® LLC, Alphabet Inc., or any other email provider —
> see the full [Trademark notice](#trademark-notice) below.

Hide.Code.Mail uses that unused space to hide a short tag inside the address
itself, so you can give a slightly different-looking address to every
service, newsletter or contact, and later read the address back to see
which one it was, with no database, no server and no account. The address
is the whole system.

A full explanation of the algorithm, including the reasoning behind every
design decision, is in [`docs/ALGORITHM.md`](docs/ALGORITHM.md).

## Using it

Open `index.html` (or the hosted page, once deployed). There are two
modes:

- **Hide a tag** — type your address and a short tag (letters and digits
  only). The page shows the tagged address to give out, and how many
  characters that particular address can carry.
- **Read a tag** — paste back a tagged address to recover the tag and the
  underlying plain address.

Everything runs client-side, in plain JavaScript, with no build step and
no dependencies beyond a Google® Fonts stylesheet link.

## Project structure

```
index.html          the page
style.css            styling
script.js            the cipher implementation and UI wiring
docs/ALGORITHM.md    full write-up of the algorithm
```

## Hosting on GitHub Pages

1. Create a new GitHub repository and push these files to it (`index.html`,
   `style.css`, `script.js`, `docs/`), keeping them at the repository root.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a
   branch**.
4. Under **Branch**, choose `main` (or whichever branch holds the files)
   and folder `/ (root)`, then save.
5. GitHub publishes the page at
   `https://<your-username>.github.io/<repository-name>/` within a minute
   or two. Re-pushing to that branch redeploys automatically.

No further configuration, secrets or build pipeline is needed: this is a
static site by design.

## Notes and limits

- The dot-insensitivity behaviour is a documented, legitimate feature of
  Gmail®/Google® Workspace (not affiliated) on `gmail.com` and
  `googlemail.com` — this tool simply makes use of it, it does not
  exploit, bypass or work around anything. We make no guarantee about
  it: it was tested by the author and worked as described on Gmail®'s own
  domains at the time of testing, nothing more. The page will still
  encode and decode addresses on other domains correctly as text, and
  other mail providers may well offer the same dot- and/or
  case-insensitive behaviour on their own addresses; if yours does,
  Hide.Code.Mail can be used with it just as well, again on a
  tested-by-the-author basis rather than any promise — verify with your
  own provider first. Using it with another provider does not imply, and
  must never be read as implying, any affiliation between Hide.Code.Mail
  and that provider either.
- This is obfuscation, not encryption, and it is easily defeated: the
  method is fully documented here, so anyone who reads this repository
  (or simply normalises the address, which many systems already do
  automatically) can undo it. It is not a real defence or security
  mechanism, and it is not meant to be one. It is meant to be the
  lowest-effort way to answer one question after the fact — "who did I
  give this particular copy of my address to" — with nothing to set up
  and no external service to rely on, not to keep that information
  secret from someone who knows the technique.

## Why dots and case, not the plus sign

Gmail® is not unique in being able to fold variations of an address into
one mailbox. Any provider could choose to do the same, and plus
addressing (`name+tag@example.com`) is already a common, widely
supported way to do it. Hide.Code.Mail deliberately does not build its tag out
of that, for a practical reason: a `+tag` is an obvious, well known
marker. Scrapers, list brokers and even ordinary signup forms routinely
strip or reject anything after a `+`, precisely because it is recognised
as a tracking device. Dots and letter case carry the same kind of
information but look like nothing more than someone's personal typing
style, which makes them far less likely to be noticed, stripped or
"cleaned" before an address changes hands.

That also gives a practical reading of what you see later. If mail from
a given contact arrives at what looks like a fully plain, dot-free,
lowercase address, there are two likely explanations: either the address
was normalised somewhere along the way (by the service itself, by a
scraper, or by whatever tool handled the list it ended up on), or you
simply never tagged that particular copy of the address to begin with.
Either reading is a useful signal, not a proof of anything on its own.

## What Hide.Code.Mail is for, and what it is not for

Hide.Code.Mail exists to answer one question after the fact: if a tagged
address you gave out starts receiving mail it should not, which copy was
that. Because the tag lives entirely inside the shape of the address
itself, recognising it needs nothing kept anywhere: not a spreadsheet,
not a database, not a note of which variant went to whom. The address
you already have in front of you is the whole record, which also means
there is nothing external to protect, leak or lose.

It is not, and must not be used as, a way to create multiple accounts on
a platform. Most major platforms already normalise usernames and email
addresses internally (stripping dots, folding case, sometimes handling
plus addressing too) for exactly this reason, to stop one person opening
several accounts with cosmetic variants of the same address. Hide.Code.Mail
does not fight that normalisation and is not built to.

## Trademark notice

Google®, Gmail® (Google Mail® (not affiliated)) and Google Workspace® are
registered trademarks of Google® LLC (a subsidiary of Alphabet Inc.), a company
entirely independent of, and unrelated to, this project. They are used
throughout this repository purely in a descriptive sense, to name the
specific, publicly documented email feature this tool relies on (see
[how Gmail® handles dots and case](docs/ALGORITHM.md)). Hide.Code.Mail
is not affiliated with, sponsored by, or endorsed by Google® LLC, Alphabet
Inc., or any other email provider or brand, and must not be confused
with an official product or service of any of them.

Using a documented, publicly available feature of a service is not the
same as exploiting, bypassing or hacking it, and Hide.Code.Mail should
not be read that way: it is a plain text transformation applied to an
address you already have, nothing more. Dot- and/or case-insensitivity
is not necessarily unique to Gmail® — other mail providers may offer
similar normalisation on their own addresses, and if yours does, nothing
stops you from using Hide.Code.Mail with it the same way (see
[Notes and limits](#notes-and-limits)). Doing so does not create, and
must never be read as implying, any affiliation between Hide.Code.Mail
and that provider either. Any other proprietary or trademarked name that
may be mentioned anywhere in this project is used under the same
descriptive, non-affiliated basis.

## Disclaimer

Hide.Code.Mail is provided as is, with no warranty of any kind.

- There is no guarantee that a tagged address will stay in its tagged
  form by the time it reaches you again. Any service, scraper or system
  in between can normalise, clean or otherwise alter it.
- Hide.Code.Mail is not intended, and must not be used, to create multiple
  accounts on any platform or to circumvent a service's account or
  anti-abuse rules.
- The tool does not store, log or transmit the addresses or tags you
  type. Everything happens as a local, in-browser text transformation.
  That also means it cannot recover anything for you: if you forget
  which tag you used, Hide.Code.Mail has no record of it either.
- Hide.Code.Mail cannot guarantee the security of any email address, cannot
  detect or prevent misuse by third parties, and offers no assurance
  about how any specific service will handle a tagged address. It only
  converts the text you already have; nothing more.

Use it with that understanding, and at your own judgement.
