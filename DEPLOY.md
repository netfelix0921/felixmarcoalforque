# Deploy — GitHub → Vercel

You already have a repo, you're comfortable in a terminal, and you want every
future `git push` to deploy itself. That's what this file walks through.

Roughly 15 minutes end to end. The AI keeps working on this path, because
Vercel runs `api/felix-ai.js` as a serverless function.

---

## Before you start

Have the new build unzipped somewhere you can reach, e.g.
`~/Downloads/felixmarcoalforque-v2/`.

Know where your existing clone lives. If you don't have one:

```bash
cd ~/code                                   # or wherever you keep projects
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
```

Confirm you're pointed at the right place:

```bash
git remote -v
git log --oneline -3
```

---

## 1. Swap the contents, keep the history

Work on a branch so `main` stays exactly as it is until you're happy.

```bash
cd ~/code/YOUR-REPO
git switch -c redesign-2026-08

# remove every tracked file (this leaves .git alone)
git rm -r --quiet .

# copy the new build in — the trailing /. matters, it brings dotfiles too
cp -R ~/Downloads/felixmarcoalforque-v2/. .

git add -A
git status
```

`git status` should show the old root files as deleted and the new
`assets/`, `api/`, `php-backend/`, `data/` tree as added.

---

## 2. Prove no secret is going up

Two checks. Both should print nothing at all.

```bash
# is a real .env staged by accident?
git diff --cached --name-only | grep -E '^\.env$'

# is an API key sitting in any tracked file?
git ls-files | xargs grep -lE 'sk-[A-Za-z0-9_-]{20,}'
```

`.env.example` is fine to commit — it holds placeholders. `.gitignore`
already blocks the real `.env`.

---

## 3. Commit and push

```bash
git commit -m "Redesign: modular dark portfolio, Felix AI client, CV, SEO files"
git push -u origin redesign-2026-08
```

Open the repo on github.com, review the diff, then merge into `main` (or
just `git switch main && git merge redesign-2026-08 && git push` if you'd
rather not open a PR).

---

## 4. Connect the repo to Vercel

If the repo is **already** linked to a Vercel project, skip this — the push
you just made is already building. Check vercel.com → your project →
Deployments.

If not:

1. vercel.com → **Add New** → **Project** → **Import Git Repository**
2. Pick the repo. Authorise GitHub access if asked.
3. **Framework Preset: Other.** This matters — there is no build step.
4. Leave **Build Command**, **Output Directory** and **Install Command**
   empty. Root Directory stays `./`.
5. **Deploy.**

You'll get a `something.vercel.app` URL. The site will be live in under a
minute; the AI won't answer yet — that's the next step.

---

## 5. Give the function its API key

The key never goes in the repo. It lives in Vercel.

1. Project → **Settings** → **Environment Variables**
2. Add `OPENAI_API_KEY` = your key. Tick Production, Preview and Development.
3. Optionally add `OPENAI_MODEL` (defaults to `gpt-4o-mini`).
4. Save.
5. **Deployments** → latest → **⋯** → **Redeploy**.

Step 5 is not optional. Environment variables are baked in at build time, so
an existing deployment will not pick up a key you just added.

---

## 6. Point the domain at it

Project → **Settings** → **Domains** → add `felixmarcoalforque.it.com` and
`www.felixmarcoalforque.it.com`.

Vercel then shows the exact DNS records to create at your registrar. Copy
them from that screen — the values differ per account and per apex/subdomain,
so don't trust records you find in a blog post.

DNS propagation is usually minutes, occasionally a few hours. Until it
resolves, the `*.vercel.app` URL keeps working, and the AI works there too:
`api/felix-ai.js` allows same-origin requests, so preview deploys aren't
blocked by the origin allowlist.

---

## 7. Check it actually works

```bash
# should return JSON with an answer about Felix
curl -s -X POST https://YOUR-DOMAIN/api/felix-ai \
  -H 'Content-Type: application/json' \
  -d '{"message":"What ERP experience does Felix have?"}' | head -c 400

# should be refused — proves the scope filter survived the move
curl -s -X POST https://YOUR-DOMAIN/api/felix-ai \
  -H 'Content-Type: application/json' \
  -d '{"message":"What is the weather today?"}' | head -c 400

# should NOT return the knowledge base (redirects to /)
curl -sI https://YOUR-DOMAIN/data/felix-knowledge-base.json | head -3
```

Then in a browser: open the site, hit the Felix AI button and ask something,
send yourself a message through the contact form, and load it once on your
phone.

---

## Every deploy after this one

```bash
git add -A
git commit -m "what changed"
git push
```

That's it. Vercel builds `main` automatically. Pushes to any other branch get
their own preview URL, which is the safe way to try a change before it's live.

---

## When something's off

**The AI panel says "not connected yet on this deployment."**
The browser got a 404 or 405 from `/api/felix-ai`. Either the Framework
Preset wasn't `Other` (a preset can bury the `api/` folder), or `api/` didn't
make it into the commit. Check `git ls-files api/`.

**The AI replies with the refusal text no matter what you ask.**
That's a 403 from the origin check. Happens if you're loading the page from a
domain that isn't in `ALLOWED_ORIGINS` in `api/felix-ai.js` and isn't
same-origin with the API. Add the domain to that array — it's near the top of
the file, around line 40.

**Function logs say "knowledge base not found."**
`data/felix-knowledge-base.json` wasn't bundled. The `includeFiles` entry in
`vercel.json` is what puts it there; make sure that file wasn't overwritten.

**Function logs say "OPENAI_API_KEY is not set."**
The variable exists but you didn't redeploy after adding it. See step 5.

**Contact form does nothing.**
EmailJS is browser-side, unrelated to Vercel. Check the browser console and
that the EmailJS service/template IDs in `assets/js/contact.js` still match
your EmailJS dashboard.

---

## If you ever go back to DirectAdmin

Nothing here breaks that. `php-backend/felix-ai.php` stays in the repo and
Vercel simply ignores it. To serve from DirectAdmin again: upload everything
except `api/` and `vercel.json`, copy `php-backend/felix-ai.php` to
`api/felix-ai.php`, merge `htaccess-root-snippet.txt` into your web-root
`.htaccess`, and put a `.env` holding `OPENAI_API_KEY` above the web root.

One difference worth knowing: the PHP backend has no same-origin fallback, so
its `FX_ALLOWED_ORIGINS` list must name every domain you serve from.
