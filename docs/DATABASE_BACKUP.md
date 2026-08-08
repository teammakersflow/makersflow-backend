# Database Backup Guide

## Overview

This document explains how to create and restore PostgreSQL database backups for the MakersFlow backend.

---

## Prerequisites

- PostgreSQL installed
- pg_dump
- pg_restore

---

## Manual Backup

Windows

```bash
scripts/backup-db.bat
```

Linux

```bash
scripts/backup-db.sh
```

---

## Restore Backup

Windows

```bash
scripts/restore-db.bat
```

Linux

```bash
scripts/restore-db.sh
```

---

## Recommended Backup Frequency

Development

- Weekly

Production

- Daily

---

## Backup Retention

Keep

- Daily backups for 7 days
- Weekly backups for 4 weeks
- Monthly backups for 6 months

---

## Notes

Never store backups inside the Git repository.

Store them in secure cloud storage or external storage.