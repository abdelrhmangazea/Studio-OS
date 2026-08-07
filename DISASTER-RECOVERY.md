# Backups and recovery — what is actually configured

Bucket 9, item 12. Read from the live project on 2026-08-07, not from
memory or assumption. Where something could not be determined from
here, it says so rather than guessing.

---

## The short version

| | |
|---|---|
| Plan | **Pro** (org `interior zone`) |
| Database backups | **Daily, automatic, 7 days of retention** |
| Backup type | **Physical** (Postgres 17.6.1.155, well past the 15.8.1.079 cutover) |
| Point-in-Time Recovery | **Add-on. Could not confirm from here — check the dashboard.** |
| Uploaded files (Storage) | **NOT in any database backup.** See below. |
| Worst-case data loss without PITR | **Up to 24 hours** |

---

## 1. The database is backed up. Daily, for 7 days.

Pro plan projects are backed up automatically every day and the last
7 days are restorable. Nothing had to be turned on and nothing is at
risk of being forgotten.

Restore from **Database → Backups → Scheduled backups** in the
Supabase dashboard. The project is **offline during a restore**, and
how long that takes scales with database size.

**What this means in practice:** if something destroys data on a
Wednesday afternoon, the newest restore point is Wednesday's daily
backup. Everything since then is gone. For a studio that has taken
three bookings and generated two contracts that morning, that is a
real loss, and there is no way to get it back.

---

## 2. THE IMPORTANT ONE — uploaded files are not in the backup

From the Supabase documentation, verbatim in substance:

> Database backups do not include objects you store via the Storage
> API, as the database only includes metadata about these objects.

This product puts a great deal in Storage:

- every generated contract, quotation and invoice PDF/DOCX
- studio logos
- transfer receipts uploaded by clients (`booking-files`, receipts)
- every file published to a client portal (`project-files`)
- files clients attach to booking questions

Restoring the database restores the **rows that describe those files**
— `files`, `receipts`, `generated_documents` — but **not the files
themselves**. After a restore you would have a `files` row pointing at
a storage object, and the object may or may not still be there.

This is not a bug and there is nothing to fix in the code. It is a
property of the platform that has to be known before it matters. Two
honest options:

1. **Accept it.** Storage objects are only lost if Storage itself
   loses them, which is a different and rarer failure than a bad
   migration or a mistaken delete. Deleting a project, however,
   permanently removes everything including backups.
2. **Take your own copy.** Periodically download the buckets to
   somewhere outside Supabase. Nothing in the product does this today.

**Not decided. Flagging it rather than choosing on your behalf.**

---

## 3. Point-in-Time Recovery — status unknown from here, and it costs money

PITR reduces worst-case loss from 24 hours to about **2 minutes**. It
is a **paid add-on**, not part of Pro:

| Retention | Approx. monthly |
|---|---|
| 7 days | ~$100 |
| 14 days | ~$200 |
| 28 days | ~$400 |

**I could not confirm whether it is enabled.** WAL archiving is
active on this database — `pg_stat_archiver` shows 340 files archived
and 0 failures — but modern Supabase uses WAL for the ordinary
physical backup process too, so that is **not** proof PITR is on. It
would be wrong to tell you it is.

**Check it yourself:** Dashboard → Database → Backups → *Point in
Time*. If the tab shows a recovery window, it is on. If it offers to
enable an add-on, it is off.

Note: enabling PITR **replaces** daily backups rather than adding to
them.

My read, for what it is worth: for a beta with a handful of studios,
$100/month to turn 24 hours of possible loss into 2 minutes is
probably not yet worth it — but it becomes worth it the moment real
studios are running real projects through this. **Your call.**

---

## 4. Things worth knowing before a restore day, not on one

- **Custom role passwords are not in daily backups.** This project
  does not use custom database roles, so nothing to reset.
- **Restoring takes the project offline.** Public booking pages and
  client portals go down with it.
- **Deleting the project deletes the backups too.** Permanently.
- The Management API can list backups and trigger a PITR restore
  without the dashboard — useful if the dashboard is what is broken.

---

## 5. What is NOT protected by any of this

Backups protect against data loss. They do not protect against:

- **A bad migration that is faithfully backed up.** Restoring to
  before it costs you everything since.
- **Storage objects.** Section 2.
- **Anything in the app's own logic.** The database-enforced
  invariants — the booking exclusion constraint, the stage gates,
  never-reused project codes — are what stop bad data being written
  in the first place. A backup is the last line, not the first.

---

## Open decisions for you

1. Confirm whether PITR is on, and decide whether to pay for it.
2. Decide whether uploaded files need a copy outside Supabase.

Neither is done. Both are yours to make.
