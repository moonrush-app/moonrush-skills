# static

Images the documentation points at. Nothing here is read at runtime, and nothing here ships
in the npm package: `package.json` `files` leaves this directory out on purpose, because the
Readme links these with absolute `raw.githubusercontent.com` URLs.

That choice is worth the sentence. npm rewrites RELATIVE image paths in a Readme to the
repository's raw content, which works until it does not: it depends on `repository` being
set correctly and on npm doing the rewrite. The same bug was already live here, with
`repository` pointing at an org that does not exist, so a relative path would have resolved
to nothing on the npm page. An absolute URL renders the same on GitHub, on npmjs, and in any
other place that shows this file.

| file | what it is |
|---|---|
| `moonrush-skills.png` | the header banner, 1200x630, the app's own OG image |
| `logo.png` | the square mark, 150x150 |

Both are copied from `moonrush-web/public`, so they are the same assets the product uses.
Replace them there first if the brand changes, then copy across; a second original here is
how the two drift.
